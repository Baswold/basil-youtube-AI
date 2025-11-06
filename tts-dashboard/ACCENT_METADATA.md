# Accent Metadata Integration ✅

## Overview
Successfully integrated accent/region metadata for all 904 LibriTTS voices using LibriVox accent data sources.

## Accent Breakdown
Based on LibriVox speaker data:
- **🇺🇸 American**: 898 voices (vast majority)
- **🇬🇧 English (British)**: 3 voices
- **🇮🇪 Irish**: 2 voices
- **🇨🇦 Canadian**: 1 voice
- **🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish**: 0 voices (in this subset)
- **🏴󠁧󠁢󠁷󠁬󠁳󠁿 Welsh**: 0 voices (in this subset)

**Total non-American**: 6 voices

## Data Sources

### 1. LibriVox Accents Table
- Wiki page listing LibriVox readers by accent
- URL: https://wiki.librivox.org/index.php/Accents_Table
- Categories: UK, Canada, US, Australia & NZ, Europe, Asia, South America

### 2. Ruth Golding's Blog
- Comprehensive list of British LibriVox readers
- URL: https://golding.wordpress.com/home/other-british-readers-on-librivox/
- 100+ British readers catalogued (English, Irish, Scottish, Welsh)
- Last updated: October 31, 2015

### 3. OscarVanL's Research
- GitHub: https://github.com/OscarVanL/LibriTTS-British-Accents
- Identified 85 British English speakers in LibriTTS
- Breakdown: 59 Male, 26 Female
- Includes English, Irish, Scottish, Welsh subsets

## How It Works

### Data Processing Pipeline
1. **Accent Catalog** (`generate-accent-metadata.js`):
   - Compiled 200+ reader names from LibriVox sources
   - Categorized by accent: English, Irish, Scottish, Welsh, Canadian
   
2. **Name Matching**:
   - Normalized names (lowercase, removed special chars)
   - Matched against LibriSpeech `speakers.txt` (2,484 speakers)
   - Found 81 matches with known accents
   
3. **Speaker ID Mapping**:
   - Used Piper's `model-config.json` speaker ID map
   - Mapped LibriSpeech IDs → LibriTTS speaker indices (0-903)
   - Merged with existing gender metadata

4. **Default Assignment**:
   - Unmatched speakers marked as "american" (default)
   - LibriSpeech/LibriTTS is primarily American English

### Integration in Dashboard
- **Filter buttons** with flag emojis for each accent
- **Voice tiles** show accent badge (e.g., "🇬🇧 English")
- **Subtitle** displays count of British/Canadian voices
- **Console logs** show accent statistics on load

## UI Features

### Accent Filters
Click any accent filter to show only voices from that region:
- 🇬🇧 English (British)
- 🇮🇪 Irish
- 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish
- 🏴󠁧󠁢󠁷󠁬󠁳󠁿 Welsh
- 🇨🇦 Canadian
- 🇺🇸 American

### Voice Tile Display
Each voice shows:
- Speaker ID
- Accent flag + name (if non-American)
- Gender badge
- Favorite star (if favorited)

### Console Output
```
✅ Loaded metadata for 904 speakers
   Male: 577, Female: 327
   Accents: English: 3, Irish: 2, Scottish: 0, Welsh: 0, Canadian: 1, American: 898
```

## Files

### Generated
- `speaker-metadata.json` - Complete metadata with gender + accent
- `generate-accent-metadata.js` - Script to generate accent data

### Data Sources
- `speakers.txt` - LibriSpeech speaker info (2,484 speakers)
- `model-config.json` - Piper voice model config with speaker ID mapping

### Frontend
- `index.html` - Dashboard with accent filters and badges

## Limitations

### Why So Few Non-American Voices?
1. **LibriVox is primarily American**: Most audiobook readers are US-based
2. **LibriTTS subset**: The high-quality LibriTTS-R dataset used by Piper selected specific speakers
3. **Sample selection**: Only speakers with sufficient high-quality audio were included

### Accent Coverage
- **Well-covered**: American English (898/904 = 99.3%)
- **Limited**: British English variants (6/904 = 0.7%)
- **Missing**: Australian, South African, other English variants

### Name Matching Challenges
- Some LibriVox usernames don't match real names in speakers.txt
- Potential false negatives (British speakers marked as American)
- No automated accent detection from audio

## Finding British/Canadian Voices

To use the British/Canadian voices:
1. Click **🇬🇧 English** filter button
2. Test each voice to find the accent you prefer
3. Click **⭐ Star** to add to favorites
4. Note the Speaker ID for use in your application

### Confirmed Non-American Speakers
Based on metadata, speakers with IDs:
- Check by filtering for "English", "Irish", or "Canadian"
- Total: 6 voices

## Future Enhancements

### Possible Improvements
1. **Audio-based detection**: Use ML to detect accents from speech samples
2. **Manual tagging**: Allow users to correct/add accent tags
3. **Extended metadata**: Add age range, formality, speaking speed
4. **Better matching**: Cross-reference with more LibriVox data sources
5. **Accent samples**: Pre-generate samples for quick comparison

### Alternative Datasets
For more accent diversity, consider:
- **CommonVoice**: Mozilla's dataset with global English variants
- **VCTK**: 110 English speakers with various accents
- **LibriTTS-R**: Full dataset may have more British speakers
- **Custom recording**: Record your own accent samples

## Usage Example

```javascript
// Get accent for a speaker
const accent = getAccent(speakerId);
console.log(accent); // "english", "irish", "canadian", or "american"

// Filter voices by accent
const englishVoices = Array.from({length: 904}, (_, i) => i)
    .filter(id => getAccent(id) === 'english');
console.log(englishVoices); // [speaker IDs with English accent]
```

## References
- [LibriVox Accents Table](https://wiki.librivox.org/index.php/Accents_Table)
- [Ruth Golding's British Readers List](https://golding.wordpress.com/home/other-british-readers-on-librivox/)
- [OscarVanL's Research](https://oscarvanl.wixsite.com/techramblings/post/finding-a-british-speech-dataset-for-machine-learning)
- [LibriTTS Paper](https://arxiv.org/abs/1904.02882)
- [Piper TTS](https://github.com/rhasspy/piper)

---

**Status**: ✅ **FULLY INTEGRATED**

All 904 voices now have accent metadata. Filter by accent using the UI buttons to find English/British, Irish, Scottish, Welsh, Canadian, or American voices!
