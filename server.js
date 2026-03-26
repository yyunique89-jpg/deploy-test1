require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jobs = require('./data/jobs.json');
const deaths = require('./data/deaths.json');

// 시대별 연도 범위 (음수 = 기원전)
const eraRanges = {
  prehistoric:          [-150000, -10000],
  neolithic:            [-10000,  -3000],
  ancient_egypt:        [-3100,   -30],
  mesopotamia:          [-3500,   -500],
  ancient_greece:       [-800,    -146],
  ancient_rome:         [-753,    476],
  three_kingdoms_korea: [-57,     668],
  goryeo:               [918,     1392],
  joseon:               [1392,    1897],
  medieval_europe:      [476,     1400],
  mongol:               [1206,    1368],
  early_modern:         [1400,    1700],
  modern:               [1700,    1900],
  contemporary:         [1900,    1980],
  fantasy:              [-150000, 1980],
  all:                  [-150000, 1980],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatYear(year) {
  if (year < 0) return `기원전 ${Math.abs(year).toLocaleString()}년`;
  return `서기 ${year}년`;
}

function getMatchingDeaths(job) {
  const typeTag = job.type; // human, animal, object, alien, microbe
  const eraTag = job.era;

  const matched = deaths.filter(d => {
    if (d.tags.includes('all')) return true;
    if (d.tags.includes(eraTag)) return true;
    if (d.tags.includes(typeTag)) return true;
    return false;
  });

  return matched.length > 0 ? matched : deaths.filter(d => d.tags.includes('all'));
}

// 랜덤 전생 정보 생성
app.get('/api/random', (req, res) => {
  const job = pickRandom(jobs);
  const range = eraRanges[job.era] || eraRanges.all;
  const year = randomInt(range[0], range[1]);
  const deathPool = getMatchingDeaths(job);
  const death = pickRandom(deathPool);

  res.json({
    job: job.name,
    jobType: job.type,
    era: job.era,
    year: formatYear(year),
    yearRaw: year,
    death: death.cause,
  });
});

// OpenAI 스토리 생성
app.post('/api/story', async (req, res) => {
  const { name, job, jobType, year, death } = req.body;

  const isNonhuman = ['animal', 'object', 'alien', 'microbe'].includes(jobType);

  const perspectiveNote = isNonhuman
    ? `\n- 이 전생은 인간이 아닌 존재(${job})의 관점에서 서술. 그 존재만의 감각과 세계관으로 묘사.`
    : '';

  const prompt = `당신은 전생을 꿰뚫어 보는 신비로운 점술사입니다.
아래 정보를 바탕으로 재미있고 흥미진진한 전생 이야기를 한국어로 작성해주세요.

[전생 정보]
현재 이름: ${name}
전생 직업/정체: ${job}
시대: ${year}
사망 원인: ${death}

[작성 규칙]
- 3~4문단으로 작성
- 유머러스하고 생생하게, 약간 과장되게 묘사${perspectiveNote}
- 이름 "${name}"에서 전생과의 신비로운 연결고리를 창의적으로 발견
- 사망 장면을 드라마틱하고 웃기게 묘사 (비극과 코미디의 경계에서)
- 마지막 문단에서 전생이 현재 삶에 남긴 흔적(특이한 버릇, 이유 모를 공포, 끌림 등) 언급
- 2~3문장 정도의 길이로 각 문단 작성`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.95,
    });

    res.json({ story: completion.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI 오류:', err.message);
    res.status(500).json({ error: '스토리 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔮 전생 탐구 서버 시작! http://localhost:${PORT}`);
});
