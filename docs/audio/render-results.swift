import AVFoundation
import AudioToolbox
import Foundation

struct Event {
    let time: Double
    let instrument: Int
    let note: UInt8
    let velocity: UInt8
    let on: Bool
}

let destination = CommandLine.arguments[1]
let rate = 44100.0
let bank = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")

func render(_ name: String, victory: Bool) throws {
    let engine = AVAudioEngine()
    let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
    let reverb = AVAudioUnitReverb()
    reverb.loadFactoryPreset(.mediumHall)
    reverb.wetDryMix = victory ? 14 : 22
    engine.attach(reverb)
    engine.connect(engine.mainMixerNode, to: reverb, format: format)
    engine.connect(reverb, to: engine.outputNode, format: format)

    let programs: [UInt8] = victory ? [56, 60, 48, 0] : [60, 57, 48, 0]
    var voices: [AVAudioUnitSampler] = []
    for (index, program) in programs.enumerated() {
        let voice = AVAudioUnitSampler()
        engine.attach(voice)
        engine.connect(voice, to: engine.mainMixerNode, format: format)
        try voice.loadSoundBankInstrument(at: bank, program: program,
            bankMSB: UInt8(index == 3 ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
        voice.masterGain = index == 0 ? -3 : index == 3 ? -11 : -10
        voices.append(voice)
    }

    var events: [Event] = []
    let beat = 60.0 / (victory ? 132.0 : 78.0)
    func note(_ instrument: Int, _ pitch: Int, _ start: Double, _ duration: Double, _ velocity: Int) {
        events.append(Event(time: start * beat, instrument: instrument, note: UInt8(pitch), velocity: UInt8(velocity), on: true))
        events.append(Event(time: (start + duration) * beat, instrument: instrument, note: UInt8(pitch), velocity: 0, on: false))
    }
    func chord(_ instrument: Int, _ pitches: [Int], _ start: Double, _ duration: Double, _ velocity: Int) {
        for pitch in pitches { note(instrument, pitch, start, duration, velocity) }
    }

    if victory {
        // Compact rising fanfare with a tonic landing and room for its release.
        let melody: [(Int, Double, Double, Int)] = [
            (67, 0, 0.18, 96), (67, 0.25, 0.18, 100), (72, 0.5, 0.40, 112),
            (76, 1, 0.40, 112), (79, 1.5, 0.60, 118),
            (77, 2.25, 0.18, 105), (76, 2.5, 0.18, 107), (74, 2.75, 0.18, 108),
            (79, 3, 0.38, 115), (84, 3.5, 1.6, 120)
        ]
        for (pitch, start, duration, velocity) in melody { note(0, pitch, start + 0.10, duration, velocity) }
        chord(1, [48, 55, 60, 64], 0.5, 1.35, 82)
        chord(1, [55, 59, 62, 65], 2.25, 1.1, 85)
        chord(1, [48, 55, 60, 64, 67], 3.5, 1.8, 95)
        chord(2, [60, 64, 67], 0.5, 1.45, 55)
        chord(2, [59, 62, 67], 2.25, 1.1, 56)
        chord(2, [60, 64, 67, 72], 3.5, 1.9, 66)
        for step in 0..<6 { note(3, 38, Double(step) * 0.5, 0.10, step % 2 == 0 ? 68 : 48) }
        for step in 0..<4 { note(3, 38, 3 + Double(step) * 0.125, 0.08, 54 + step * 7) }
        for start in [0.5, 2.25, 3.5] { note(3, 36, start, 0.15, 85) }
        note(3, 49, 3.5, 0.4, 74)
    } else {
        // One descending minor phrase, leaving a natural instrumental tail.
        let melody: [(Int, Double, Double, Int)] = [
            (67, 0.05, 0.55, 76), (63, 0.7, 0.5, 73),
            (62, 1.35, 0.5, 66), (60, 2.05, 1.05, 68)
        ]
        for (pitch, start, duration, velocity) in melody { note(0, pitch, start, duration, velocity) }
        chord(1, [36, 43, 48], 0, 1.2, 46)
        chord(1, [31, 38, 43], 1.3, 0.65, 43)
        chord(1, [36, 43, 48], 2.05, 1.1, 42)
        chord(2, [48, 55, 60, 63], 0, 1.2, 50)
        chord(2, [43, 50, 55, 59], 1.3, 0.65, 47)
        chord(2, [48, 55, 60, 63], 2.05, 1.1, 47)
        note(3, 41, 0, 0.2, 38)
    }

    events.sort { $0.time == $1.time ? (!$0.on && $1.on) : $0.time < $1.time }
    let duration = 3.85
    let totalFrames = AVAudioFramePosition(duration * rate)
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 1024)
    engine.prepare()
    try engine.start()
    let output = URL(fileURLWithPath: destination).appendingPathComponent(name + "-raw.wav")
    let file = try AVAudioFile(forWriting: output, settings: format.settings)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
    var cursor = 0
    while engine.manualRenderingSampleTime < totalFrames {
        let current = engine.manualRenderingSampleTime
        while cursor < events.count && AVAudioFramePosition(events[cursor].time * rate) <= current {
            let event = events[cursor]
            let channel: UInt8 = event.instrument == 3 ? 9 : 0
            if event.on { voices[event.instrument].startNote(event.note, withVelocity: event.velocity, onChannel: channel) }
            else { voices[event.instrument].stopNote(event.note, onChannel: channel) }
            cursor += 1
        }
        let next = cursor < events.count ? AVAudioFramePosition(events[cursor].time * rate) : totalFrames
        let count = AVAudioFrameCount(min(1024, totalFrames - current, max(1, next - current)))
        let status = try engine.renderOffline(count, to: buffer)
        if status == .success { try file.write(from: buffer) }
        else if status == .error { throw NSError(domain: "OfflineMusic", code: 1) }
    }
    engine.stop()
    print("Rendered \(name): \(String(format: "%.2f", duration)) seconds")
}

try render("victory-fanfare-short", victory: true)
try render("defeat-lament-short", victory: false)
