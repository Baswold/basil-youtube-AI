import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Using libritts-high multi-speaker model
const MODEL_NAME = 'en_US-libritts-high';

/**
 * Check if Piper is installed
 */
function checkPiperInstallation() {
    try {
        execSync('piper --help', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Synthesize speech using Piper CLI with speaker selection
 */
async function synthesizeWithPiper(text, speaker = 0) {
    return new Promise((resolve, reject) => {
        const tmpFile = `${os.tmpdir()}/tts_${Date.now()}.wav`;
        const modelPath = `${os.homedir()}/.local/share/piper_tts/${MODEL_NAME}/${MODEL_NAME}.onnx`;

        // Check if model exists
        if (!fs.existsSync(modelPath)) {
            reject(new Error(`Voice model not found at: ${modelPath}\n\nPlease download it first.`));
            return;
        }

        // Use piper CLI with full model path and speaker selection
        const args = [
            '--model', modelPath,
            '--output_file', tmpFile
        ];

        // Add speaker parameter if specified
        if (speaker !== undefined && speaker !== null) {
            args.push('--speaker', String(speaker));
        }

        const piper = spawn('piper', args);
        let stderr = '';

        piper.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // Send text to stdin
        piper.stdin.write(text);
        piper.stdin.end();

        piper.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || 'Piper synthesis failed'));
                return;
            }

            try {
                const audio = fs.readFileSync(tmpFile);
                fs.unlinkSync(tmpFile);
                resolve(audio);
            } catch (error) {
                reject(error);
            }
        });

        piper.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * TTS Synthesis endpoint
 */
app.post('/api/tts/synthesize', async (req, res) => {
    try {
        const { text, speaker = 0 } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!text.trim()) {
            return res.status(400).json({ error: 'Text cannot be empty' });
        }

        // Validate speaker
        const speakerNum = parseInt(speaker, 10);
        if (isNaN(speakerNum) || speakerNum < 0 || speakerNum > 903) {
            return res.status(400).json({
                error: `Invalid speaker ID. Must be between 0 and 903.`,
            });
        }

        // Check Piper installation
        if (!checkPiperInstallation()) {
            return res.status(503).json({
                error: 'Piper TTS engine not found. Please install it with: pip install piper-tts',
            });
        }

        const audioBuffer = await synthesizeWithPiper(text, speakerNum);

        // Send audio as WAV file
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', audioBuffer.length);
        res.send(audioBuffer);

        console.log(`[TTS] ✓ Synthesis complete for speaker ${speakerNum}`);
    } catch (error) {
        console.error('[TTS] Synthesis failed:', error);
        res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    const piperAvailable = checkPiperInstallation();
    
    // Load metadata if available
    let metadataStats = null;
    try {
        const metadata = JSON.parse(fs.readFileSync(`${__dirname}/speaker-metadata.json`, 'utf-8'));
        const genderCounts = Object.values(metadata).reduce((acc, speaker) => {
            acc[speaker.gender] = (acc[speaker.gender] || 0) + 1;
            return acc;
        }, {});
        metadataStats = {
            total: Object.keys(metadata).length,
            genderCounts,
        };
    } catch (error) {
        metadataStats = { error: 'Metadata file not found' };
    }
    
    res.json({
        status: 'ok',
        piper: {
            available: piperAvailable,
        },
        model: MODEL_NAME,
        speakerRange: '0-903',
        metadata: metadataStats,
    });
});

/**
 * Start server
 */
app.listen(PORT, () => {
    console.log('\n🎤 Piper TTS Testing Server');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log('');

    const piperAvailable = checkPiperInstallation();
    console.log(`Piper Status: ${piperAvailable ? '✓ Ready' : '✗ Not found'}`);
    console.log('');

    if (!piperAvailable) {
        console.warn('⚠️  Piper TTS not found!');
        console.warn('Install it with: pip install piper-tts');
    } else {
        console.log(`✓ Model: ${MODEL_NAME}`);
        console.log('✓ Ready to synthesize 900+ different voices!');
    }

    console.log('\nPress Ctrl+C to stop\n');
});
