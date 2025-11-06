#!/usr/bin/env node

import { RealAdapterFactory } from './apps/backend/src/adapters/factory.js';

async function testCoquiTTS() {
    console.log('🧪 Testing Coqui TTS with VCTK dataset...');

    const factory = new RealAdapterFactory({
        ttsProvider: 'coqui'
    });

    try {
        // Test Claude voice (should use VCTK_p226 - 22yo male English)
        const claudeTTS = await factory.tts('claude');
        console.log('✅ Claude TTS adapter created');

        // Test synthesis
        await claudeTTS.synthesize('test-session', 'Hello from Coqui TTS with British accent!');
        console.log('✅ Synthesis completed');

        // Test guest voice (should use VCTK_p225 - 23yo female English)
        const guestTTS = await factory.guestTts();
        console.log('✅ Guest TTS adapter created');

        await guestTTS.synthesize('test-session-2', 'This is a British female voice from the VCTK dataset.');
        console.log('✅ Guest synthesis completed');

        console.log('🎉 All tests passed! Coqui TTS is working with VCTK dataset.');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testCoquiTTS();
