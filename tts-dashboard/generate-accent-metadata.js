import fs from 'fs';

// British readers from Ruth Golding's blog and LibriVox Accents Table
const accentData = {
    // English/British (General)
    english: [
        "Paul Adams", "Tony Addison", "ashleighjane", "Mary Bard", "David Barnes", 
        "Stuart Bell", "Phil Benson", "Christine Blachford", "Jack Blake", "Edmund Bloxam",
        "Rob Board", "Carol Box", "Nigel Boydell", "Deborah Brabyn", "Justin Brett",
        "Tim Bulkeley", "Garth Burton", "Steve C", "rosehip", "Chris Cartwright",
        "Clive Catterall", "Alan Chant", "Hazel Chant", "Anne Cheng", "David Clarke",
        "Martin Clifton", "Andrew Coleman", "Sally Ann Cook", "corina23", "Paul Curran",
        "Rebecca Dittman", "Robert Dixon", "Lizzie Driver", "Michele Eaton", "Patrick Eaton",
        "Simon Evers", "Joseph Finkberg", "Malcolm Fisher", "FNH", "Tony Foster",
        "Reynard T. Fox", "Sandra G", "Martin Geeson", "Ruth Golding", "RuthieG",
        "Chris Goringe", "Steve Gough", "Kevin Green", "Phil Griffiths", "John Hayward",
        "hefyd", "Nick Hillier", "Jonathan Horniblow", "icyjumbo", "Jon Ingram",
        "Peter Jones", "Peter John Keeble", "gkeeling", "Verity Kendall", "Carol Eades King",
        "Ian King", "Edward Kirkby", "laineyben", "Simon Larois", "Alex Lau",
        "Anthony Lee", "Nicole Lee", "Ben Lindsey-Clark", "Rachel Lintern", "Mair",
        "Carl Manchester", "CarlManchester", "Kenneth Thompson Marchesi", "Paul Mazumdar", 
        "Jason Mills", "Andy Minter", "MorganScorpion", "Rod Moss", "Jim Mowatt",
        "Mil Nicholson", "Anthony Ogus", "Lucy Perry", "Philippa", "Adrian Praetzellis",
        "SamR", "Sean Randall", "ravenotation", "Graham Redman", "David Richardson",
        "Cori Samuel", "Cori", "Karen Savage", "Claire Schreuder", "Arup Sen",
        "Christopher Smith", "Christine Stevens", "Helen Taylor", "thebicyclethief",
        "thechanneler", "Lynne Thompson", "TimSC", "TRUEBRIT", "Abigail W",
        "Patrick Wallace", "Jack Watson", "Warr", "Elaine Webb", "Alan Weyman",
        "Adrian Wheal", "Nick Whitley", "Adam Whybray", "Dave Wills", "Jay Wills",
        "Peter Yearsley", "Peter Why", "Lucy_k_p", "Quinkish", "elaineandsparky",
        "Stuart", "Jhiu", "Boojumuk", "earthcalling", "Nicholas19", "ravells",
        "russiandoll", "gemlad", "carolb", "Mango", "MichaelMaggs", "Mike001",
        "paradise.camouflage", "catrose", "Secrets"
    ],
    
    // Irish
    irish: [
        "Barty Begley", "DublinGothic", "inkling", "iremonger", "Frank Lennon",
        "Brendan MacKenzie", "Anthony Orr", "Sebastian Stephenson", "Tadhg Hynes"
    ],
    
    // Scottish
    scottish: [
        "Andy James Callaghan", "RosslynCarlyle", "Charlie Macdonald", 
        "Rachael Nowotny", "Ian Skillen"
    ],
    
    // Welsh
    welsh: [
        "Charlotte Duckett", "Brian Morgan"
    ],
    
    // Canadian
    canadian: [
        "smijen", "Winnifred", "seanmhogan", "Starlite", "Tricia G",
        "jpercival", "Paks6", "hugh", "Jc"
    ],
    
    // American (vast majority - we'll mark as default)
    american: []  // Will be default for unmarked speakers
};

// Normalize name for matching (remove special chars, lowercase)
function normalizeName(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Create lookup map
const accentLookup = {};
for (const [accent, names] of Object.entries(accentData)) {
    for (const name of names) {
        const normalized = normalizeName(name);
        accentLookup[normalized] = accent;
    }
}

// Parse speakers.txt
const speakersText = fs.readFileSync('speakers.txt', 'utf-8');
const speakerLines = speakersText.split('\n').filter(line => !line.startsWith(';') && line.trim());

const speakerAccents = {};
let matchedCount = 0;
let totalSpeakers = 0;

speakerLines.forEach(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 5) {
        const readerId = parts[0];
        const readerName = parts[4];
        const normalizedName = normalizeName(readerName);
        
        totalSpeakers++;
        
        // Check for accent match
        let accent = accentLookup[normalizedName];
        
        // If no match, default to American (since LibriSpeech is primarily American)
        if (!accent) {
            accent = 'american';
        } else {
            matchedCount++;
        }
        
        speakerAccents[readerId] = {
            readerId,
            name: readerName,
            accent
        };
    }
});

console.log(`✅ Processed ${totalSpeakers} speakers from speakers.txt`);
console.log(`📍 Matched ${matchedCount} with known British/Irish/Scottish/Welsh/Canadian accents`);
console.log(`📍 ${totalSpeakers - matchedCount} marked as American (default)`);

// Now map to LibriTTS speaker IDs using model-config.json
const modelConfig = JSON.parse(fs.readFileSync('model-config.json', 'utf-8'));
const speakerIdMap = modelConfig.speaker_id_map;

const finalMetadata = {};
let mappedCount = 0;

// speakerIdMap format: { "p3922": 0, "p8699": 1, ... }
// We need to map the other way: speaker index -> accent
for (const [libriSpeakerId, speakerIndex] of Object.entries(speakerIdMap)) {
    const libriId = libriSpeakerId.replace('p', '');
    if (speakerAccents[libriId]) {
        finalMetadata[speakerIndex] = {
            ...finalMetadata[speakerIndex] || {}, // Preserve existing metadata
            ...speakerAccents[libriId],
            speaker: libriSpeakerId,
            libriSpeakerId
        };
        mappedCount++;
    }
}

// Merge with existing speaker-metadata.json if it exists
if (fs.existsSync('speaker-metadata.json')) {
    const existing = JSON.parse(fs.readFileSync('speaker-metadata.json', 'utf-8'));
    for (const [key, value] of Object.entries(existing)) {
        if (finalMetadata[key]) {
            finalMetadata[key] = { ...value, ...finalMetadata[key] };
        } else {
            finalMetadata[key] = { ...value, accent: 'american' }; // default
        }
    }
}

// Write the result
fs.writeFileSync('speaker-metadata.json', JSON.stringify(finalMetadata, null, 2));

console.log(`\n✅ Created metadata for ${Object.keys(finalMetadata).length} speakers`);
console.log(`📍 Mapped ${mappedCount} LibriTTS speaker IDs to accents`);

// Count accents
const accentCounts = {};
for (const meta of Object.values(finalMetadata)) {
    accentCounts[meta.accent] = (accentCounts[meta.accent] || 0) + 1;
}

console.log('\n📊 Accent breakdown:');
for (const [accent, count] of Object.entries(accentCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${accent}: ${count}`);
}

console.log('\n✅ Written to speaker-metadata.json');
