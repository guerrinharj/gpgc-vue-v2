// src/utils/detect-bpm.js

// Lightweight, approximate tempo detector. No extra dependencies.
// Works on the original audio URL, not on the speed-adjusted playback.
export async function detectBpmFromUrl(url) {
    const response = await fetch(url, { mode: 'cors' });

    if (!response.ok) {
        throw new Error(`Audio request failed: ${response.status}`);
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        throw new Error('Web Audio API is unavailable');
    }

    const context = new AudioContextClass();
    let buffer;

    try {
        buffer = await context.decodeAudioData(await response.arrayBuffer());
    } finally {
        await context.close();
    }

    const sampleRate = buffer.sampleRate;
    const hop = Math.max(1, Math.round(sampleRate / 100));
    const start = Math.min(Math.floor(sampleRate * 5), Math.floor(buffer.length * 0.1));
    const end = Math.min(buffer.length, start + sampleRate * 90);
    const channels = Math.min(2, buffer.numberOfChannels);

    if (end - start < sampleRate * 8 || !channels) {
        return null;
    }

    const audio = Array.from(
        { length: channels },
        (_, i) => buffer.getChannelData(i)
    );

    const frames = Math.floor((end - start) / hop);
    const energy = new Float32Array(frames);

    for (let frame = 0; frame < frames; frame++) {
        const offset = start + frame * hop;
        let sum = 0;

        for (let i = 0; i < hop; i += 4) {
            let value = 0;

            for (let c = 0; c < channels; c++) {
                value += audio[c][offset + i] || 0;
            }

            value /= channels;
            sum += value * value;
        }

        energy[frame] = Math.sqrt(sum / Math.ceil(hop / 4));
    }

    const onset = new Float32Array(frames);
    let previous = 0;

    for (let i = 0; i < frames; i++) {
        const delta = energy[i] - previous;
        onset[i] = Math.max(0, delta);
        previous = previous * 0.75 + energy[i] * 0.25;
    }

    let bestBpm = null;
    let bestScore = -Infinity;

    for (let bpm = 60; bpm <= 180; bpm++) {
        const lag = 6000 / bpm;
        let score = 0;

        for (let i = Math.ceil(lag); i < frames; i++) {
            const at = i - lag;
            const index = Math.floor(at);
            const fraction = at - index;

            const delayed =
                onset[index] * (1 - fraction) +
                (onset[index + 1] || 0) * fraction;

            score += onset[i] * delayed;
        }

        score *= 1 - Math.abs(bpm - 115) / 1000;

        if (score > bestScore) {
            bestScore = score;
            bestBpm = bpm;
        }
    }

    return bestScore > 0.00001 ? bestBpm : null;
}