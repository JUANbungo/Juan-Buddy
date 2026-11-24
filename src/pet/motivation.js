'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.JBMotivation = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const COUNTRY_LANG_MAP = {
    Philippines: { language: 'Tagalog / Filipino', needsRomanization: false },
    Thailand: { language: 'Thai', needsRomanization: true },
    Vietnam: { language: 'Vietnamese', needsRomanization: false },
    Indonesia: { language: 'Bahasa Indonesia', needsRomanization: false },
    Malaysia: { language: 'Bahasa Melayu', needsRomanization: false },
    Singapore: { language: 'Singlish / English', needsRomanization: false },
    India: { language: 'Hindi', needsRomanization: true },
    Japan: { language: 'Japanese', needsRomanization: true },
    China: { language: 'Mandarin Chinese', needsRomanization: true },
    Russia: { language: 'Russian', needsRomanization: true },
    Italy: { language: 'Italian', needsRomanization: false },
  };

  const FALLBACK_QUOTES = {
    Philippines: { native: 'Kaya mo yan! Pahinga saglit at inom ng tubig!', romanization: '', translation: 'You got this! Take a short break and drink water!' },
    Thailand: { native: 'สู้ๆ นะ! วันนี้ต้องเป็นวันที่ดีแน่ๆ!', romanization: 'Su-su na! Wan-ni tong pen wan thi di nae-nae!', translation: 'Keep fighting! Today is definitely going to be a great day!' },
    Vietnam: { native: 'Cố lên nhé! Hôm nay sẽ là một ngày tốt lành!', romanization: '', translation: "Keep going! Today will be a good day!" },
    Indonesia: { native: 'Semangat! Hari ini pasti harimu!', romanization: '', translation: 'Stay strong! Today is definitely your day!' },
    Malaysia: { native: 'Awak boleh buat! Jaga diri ye!', romanization: '', translation: 'You can do it! Take care of yourself!' },
    Singapore: { native: 'Steady lah! Break a bit also okay one!', romanization: '', translation: 'You are doing well! A little break is okay!', },
    India: { native: 'तुम बहुत अच्छा कर रहे हो! हार मत मानना!', romanization: 'Tum bahut achha kar rahe ho! Haar mat manna!', translation: 'You are doing great! Never give up!' },
    Japan: { native: '頑張って！一歩ずつ進もうね！', romanization: 'Ganbatte! Ippo zutsu susumou ne!', translation: 'Do your best! Let us move forward one step at a time!' },
    China: { native: '加油！你今天做得非常棒！', romanization: 'Jiāyóu! Nǐ jīntiān zuò de fēicháng bàng!', translation: 'Keep going! You are doing amazing today!' },
    Russia: { native: 'У тебя всё получится! Я в тебя верю!', romanization: 'U tebya vsyo poluchitsya! Ya v tebya veryu!', translation: 'You will succeed! I believe in you!' },
    Italy: { native: 'Forza! Ogni piccolo passo conta!', romanization: '', translation: 'Stay strong! Every small step counts!' },
  };

  function fallbackEvent(pet) {
    const fb = FALLBACK_QUOTES[pet.country] || FALLBACK_QUOTES.Philippines;
    return {
      eventTitle: 'Positive Pet Blessing',
      ...fb,
      bonusCoins: 10,
      speaker: pet.name || 'Buddy',
      offline: true,
    };
  }

  async function generatePetEvent(pet, context) {
    const langInfo = COUNTRY_LANG_MAP[pet.country] || { language: 'English', needsRomanization: false };
    const systemPrompt = `You are ${pet.name}, an adorable 16-bit desktop taskbar pet (${pet.species}) from ${pet.country}.
Generate a heartwarming, positive motivational message for your owner in ${langInfo.language}.
Keep it short (max 14 words) so it fits inside a small taskbar speech bubble.
Respond ONLY in valid JSON with this exact structure:
{
  "eventTitle": "short 2-4 word positive event title in English",
  "native": "the motivational message in ${langInfo.language}",
  "romanization": "${langInfo.needsRomanization ? 'easy-to-read Latin romanization' : ''}",
  "translation": "short English translation",
  "bonusCoins": 15
}`;

    const userPrompt = `Trigger type: ${context}. Give your owner an uplifting, culturally warm encouragement right now.`;

    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new Error('MISTRAL_API_KEY not set');
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 140,
          temperature: 0.85,
        }),
      });
      if (!response.ok) throw new Error(`Mistral API error: ${response.status}`);
      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      return {
        eventTitle: String(parsed.eventTitle || 'Buddy Encouragement'),
        native: String(parsed.native || ''),
        romanization: String(parsed.romanization || ''),
        translation: String(parsed.translation || ''),
        bonusCoins: Number(parsed.bonusCoins) >= 0 ? Math.min(200, Math.round(Number(parsed.bonusCoins))) : 10,
        speaker: pet.name || 'Buddy',
        flag: pet.flag || '',
        offline: false,
      };
    } catch (err) {
      const fb = fallbackEvent(pet);
      fb.flag = pet.flag || '';
      return fb;
    }
  }

  return { COUNTRY_LANG_MAP, FALLBACK_QUOTES, generatePetEvent, fallbackEvent };
});
