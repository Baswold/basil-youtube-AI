import fs from 'fs';

// Parse SPEAKERS.TXT to get speaker ID -> gender mapping
const speakersText = fs.readFileSync('speakers.txt', 'utf-8');
const speakerGenders = {};

speakersText.split('\n').forEach(line => {
    if (line.startsWith(';') || line.trim() === '') return;

    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 2) {
        const speakerId = parts[0];
        const gender = parts[1];
        if (speakerId && gender && (gender === 'M' || gender === 'F')) {
            speakerGenders[speakerId] = gender;
        }
    }
});

console.log(`Loaded ${Object.keys(speakerGenders).length} speakers from SPEAKERS.TXT`);

// Parse model config to get speaker_id_map
const modelConfig = JSON.parse(fs.readFileSync('model-config.json', 'utf-8'));
const speakerIdMap = modelConfig.speaker_id_map;

console.log(`Model has ${Object.keys(speakerIdMap).length} speakers`);

// Create mapping from numeric ID (0-903) to gender
const metadata = {};

for (const [speakerName, numericId] of Object.entries(speakerIdMap)) {
    // Speaker names are like "p3922", extract the numeric part
    const match = speakerName.match(/^p(\d+)$/);
    if (match) {
        const libriSpeakerId = match[1];
        const gender = speakerGenders[libriSpeakerId];

        if (gender) {
            metadata[numericId] = {
                speaker: speakerName,
                libriSpeakerId: libriSpeakerId,
                gender: gender === 'M' ? 'male' : 'female'
            };
        } else {
            // Speaker not found in SPEAKERS.TXT
            metadata[numericId] = {
                speaker: speakerName,
                libriSpeakerId: libriSpeakerId,
                gender: null
            };
        }
    }
}

console.log(`Created metadata for ${Object.keys(metadata).length} speakers`);

// Count gender distribution
const males = Object.values(metadata).filter(m => m.gender === 'male').length;
const females = Object.values(metadata).filter(m => m.gender === 'female').length;
const unknown = Object.values(metadata).filter(m => m.gender === null).length;

console.log(`\nGender distribution:`);
console.log(`  Male: ${males}`);
console.log(`  Female: ${females}`);
console.log(`  Unknown: ${unknown}`);

// Save to JSON file
fs.writeFileSync('speaker-metadata.json', JSON.stringify(metadata, null, 2));
console.log(`\nSaved metadata to speaker-metadata.json`);
