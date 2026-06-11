// YiminScope · DeepSeek AI 服务封装（CommonJS, 零第三方依赖）
// 所有模型名 / baseURL 都从环境变量读取，方便在不改代码的情况下调整。

const BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL_FAST = process.env.DEEPSEEK_MODEL_FAST || "deepseek-v4-flash"; // 追问 / 免费初测
const MODEL_PRO  = process.env.DEEPSEEK_MODEL_PRO  || "deepseek-v4-flash"; // 完整报告

// 各目的国移民逻辑要点，帮助模型按正确的路径常识来判断（仅作常识参照，不构成法律意见）
const COUNTRY_GUIDE = {
  "加拿大":"打分制为主（Express Entry CRS + 省提名 PNP）：年龄、学历、语言(雅思 CLB)、加拿大相关工作经验是核心；技工与 STEM 职业有专门通道。",
  "澳大利亚":"SkillSelect 技术移民打分（189/190/491），及格 65 分：年龄、英语、工作经验、学历、职业评估、紧缺职业清单(MLTSSL/STSOL)是关键；另有雇主担保与投资类。",
  "美国":"职业移民为主：EB-1A 杰出人才、EB-2 NIW 国家利益豁免(看成就/影响力)，EB-5 投资(看资金额度与来源合规)，以及雇主担保排期问题。",
  "新西兰":"Skilled Migrant 6 分制：职业、收入门槛、学历与英语；对紧缺职业与本地 offer 友好。",
  "英国":"Skilled Worker(需担保雇主+薪资门槛)、Global Talent(看领域成就)、Innovator Founder(创业)，及留学转工签。",
  "新加坡":"以就业准证 EP(看薪资+学历)逐步申请 PR，或 GIP 全球投资者计划(高额投资)。",
  "中国香港":"高才通 TTPS(高薪或合资格名校毕业)、优才 QMAS(综合计分)、留学进修 IANG、专才；周期相对短。",
  "德国":"欧盟蓝卡(EU Blue Card)：需被认证的学历 + 工作合同 + 薪资门槛；德语对部分岗位重要，IT 等可英语。",
  "葡萄牙":"黄金签证(投资，如基金/创造就业)、D7(被动收入)、D8(数字游民)；语言门槛低，重在资金/收入证明与居住要求。",
  "日本":"高度人才积分制(HSP)：学历、年收入、年龄、日语能力等计分，70 分起有快速永住通道；另有经营管理签(创业投资)。"
};
function countryNote(p){
  const cs = (p && p.countries) || [];
  if (!cs.length) return "";
  const lines = cs.filter(c => COUNTRY_GUIDE[c]).map(c => `· ${c}：${COUNTRY_GUIDE[c]}`).join("\n");
  return `\n用户考虑的目的国及其移民逻辑要点（按各国正确路径常识判断，不要张冠李戴）：\n${lines}\n`;
}

const RULES = `你是 YiminScope 移民雷达的 AI 移民竞争力诊断引擎。严格遵守：
1. 只做"竞争力/匹配度"诊断与信息参考，覆盖加拿大、澳大利亚、美国、新西兰、英国、新加坡、中国香港、德国、葡萄牙、日本。
2. 评分代表"竞争力/匹配度"，**不是**签证或永居获批概率。
3. 禁止输出："保证通过""一定能办""稳过""100%""获批概率百分比""包过""保签"等承诺性或绝对化词语。
4. 必须体现"政策会变动、最终以官方与持牌移民顾问/律师为准"的审慎口吻；这是信息参考，**不构成移民、法律或投资建议**。
5. 不推销中介、不做代办导流。
6. 语气专业、直接、克制，使用简体中文。
7. **品牌口吻**：需要自称时用"移民雷达"，不要自称"AI""人工智能""作为AI""模型"；不要出现"AI 建议/AI 认为"这类说法，直接给判断即可。
8. 只输出严格 JSON，不要 Markdown、不要解释性文字。`;

async function chat(messages, { model = MODEL_FAST, json = true, temperature = 0.4 } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 110000);
  try {
    const r = await fetch(BASE.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model, messages, temperature, ...(json ? { response_format: { type: "json_object" } } : {}) }),
      signal: ctrl.signal,
    });
    if (!r.ok) { const txt = await r.text(); throw new Error("DeepSeek HTTP " + r.status + ": " + txt.slice(0, 300)); }
    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
    if (!json) return content;
    return JSON.parse(content);
  } finally { clearTimeout(t); }
}

const J = (o) => "```\n" + JSON.stringify(o, null, 1) + "\n```";

// ---------- 1) AI 追问 ----------
async function followUp(payload) {
  const p = payload.profile || {};
  const deep = !!payload.deep; // 付费后的深度追问：问得更多、更细、更对症
  const ask = deep
    ? `用户已付费、很认真，愿意为更准的报告多回答几个问题。请生成 4–6 个**更深入、更具体、按目标国差异化**的追问，用来显著提升报告精度。${countryNote(p)}
要点方向（按用户的目标国与路径挑最相关的来问，不要泛泛）：
- 语言：具体考了什么、各单项分、还能提多少；
- 职业/学历：具体职位与年限、学历是否受认证(如加拿大 ECA)、是否做过职业评估(如澳洲 EA/VETASSESS)、本科院校是否进入目标国名校名单(如香港高才)；
- 资金/投资：可投资金额、资金来源是否可解释、能接受的投资形式；
- 时间与意愿：期望何时登陆、能否接受先工签/留学过渡、能否全家随行；
- 风险史：是否有过拒签/犯罪/重大病史等可能影响申请的情况。
每题要短、具体、好回答，并附一句"为什么问"。最多 6 个。`
    : `请根据用户已填的移民背景，生成 2–3 个最关键的追问问题。${countryNote(p)}
要求：最多 3 个；只问会显著影响竞争力判断、且用户尚未明确回答的（例如：是否已有语言成绩、职业是否在紧缺清单、投资资金额度与来源合规、能否接受工签/留学过渡）；每题附一句"为什么问"；问题要短、具体、好回答。`;
  const messages = [
    { role: "system", content: RULES },
    { role: "user", content:
`${ask}

用户信息：
${J(p)}

只输出如下 JSON：
{"questions":[{"question":"string","reason":"string","fieldKey":"string"}]}` },
  ];
  const out = await chat(messages, { model: MODEL_FAST });
  if (!out || !Array.isArray(out.questions)) throw new Error("BAD_SHAPE");
  return { questions: out.questions.slice(0, deep ? 6 : 3) };
}

// ---------- 2) 免费初测文案（分数与排名由规则引擎给定，模型只润色） ----------
async function freeResult(payload) {
  const p = payload.profile || {};
  const messages = [
    { role: "system", content: RULES },
    { role: "user", content:
`这是免费初测。规则引擎已算出综合移民竞争力 ${payload.overall}/100（${payload.grade} 档），各国匹配度初步判断如下（分数为竞争力/匹配度，非获批概率）：
${J(payload.verdicts || [])}${countryNote(p)}

请基于用户信息与上述判断，写出克制、专业的免费初测文案。不要展开完整方案、不要编造新分数或国家、不要承诺获批。

用户信息：
${J(p)}

只输出如下 JSON：
{"summary":"一段 2-3 句的初步判断（点出最匹配国家与路径方向）","topRisks":["风险1","风险2","风险3"],"shortAdvice":"一句简短可执行建议"}` },
  ];
  const out = await chat(messages, { model: MODEL_FAST });
  if (!out || typeof out.summary !== "string") throw new Error("BAD_SHAPE");
  return out;
}

// ---------- 3) 完整报告 ----------
async function fullReport(payload) {
  const r = payload.report || {};
  const p = payload.profile || {};
  const countries = (r.rows || []).slice(0, 3).map(x => x.name);
  const messages = [
    { role: "system", content: RULES },
    { role: "user", content:
`这是一份付费完整移民诊断报告。综合分、各国匹配度分数与最优路径已由规则引擎给定（见"报告上下文"），**请勿修改任何分数或国家排名**。你的任务：基于用户真实信息，为下列每一部分生成**具体、个性化、有依据**的中文判断与方案。

${countryNote(p)}

写作硬性要求（直接决定报告是否物有所值）：
1. 逐国方案必须各不相同：结合每个国家的真实移民逻辑(打分项/门槛/职业清单/资金要求/薪资线/审批周期)与该用户的具体差距来写，严禁多国套用同一套话术。
2. 各部分不要重复：整体判断、逐国方案、风险三处给不同角度的信息增量。
3. 要具体、带数字、可执行：尽量给出"打分大致区间、近期参考分数线/薪资门槛、审批周期、费用拆解、考到什么分、做什么认证"，少说"建议提升语言"这类空话。数字用"约/近期参考"等审慎措辞，不要伪装成官方承诺。
4. **说人话**：像一个靠谱的过来人在跟朋友讲，不要 AI 腔。禁止空洞排比、禁止"在…的同时""不仅…而且""综上所述"等套话，句子有长有短，可以有具体场景和取舍判断。
5. 必须审慎：体现政策会变、以官方与持牌顾问为准；不得承诺获批、不得给获批百分比、不得出现"保证/稳过/包过/100%"。

报告上下文（只读，含分数与排名）：
${J(r)}

用户完整背景与追问回答：
${J(p)}

请严格按以下 JSON 输出（countryPlans 针对这些国家，名称精确匹配：${JSON.stringify(countries)}）：
{
 "profileScan":{"highlights":["这位申请人最值得拿出来说的加分项1(具体)","加分项2","加分项3"],"redFlags":["明显的硬伤/风险信号1(如年龄偏大、语言未达标、资金不足、缺海外经历等)","硬伤2"]},
 "executiveSummary":{"oneSentenceConclusion":"string","bestCountryWhy":"最大机会(哪个国家/路径，为什么)","mainRisk":"最大风险","recommendedStrategy":"建议的总体策略(可双线并行)"},
 "comparisonInsight":"横向对比这几个国家的一段话：各自的优势/代价/适合什么人，帮用户取舍",
 "factorAdvice":[{"factor":"年龄|学历|语言|工作经验|资金实力|适应力 之一","analysis":"针对该用户的具体分析","improvementAdvice":"可执行的提升建议"}],
 "strengths":[{"title":"优势点","detail":"为什么是优势、在移民里怎么用好"}],
 "weaknesses":[{"title":"短板点","detail":"影响与改法","priority":"高|中|低"}],
 "countryPlans":[{"country":"<精确国名>","recommendedPath":"推荐路径名","whyPath":"为什么走这条(结合该国逻辑与用户条件)","pointsEstimate":"该国打分/门槛的大致估算与近期参考线(如：加拿大 CRS 自评约430-460，近期邀请线约480+；或薪资门槛/积分线)，措辞审慎","processingTime":"大致审批周期(如 约12-18个月)","keyThresholds":["关键门槛1","门槛2"],"timeline":["按阶段/月的时间线1","2"],"costRange":"费用预算区间(人民币)","costBreakdown":[{"item":"费用项(如语言考试/学历认证/签证申请/中介可选)","amount":"金额或区间"}],"improvementToQualify":["要达标需要做的具体动作1","2"],"prCitizenship":"拿到身份后到永居/入籍的大致路径与年限","risks":[{"severity":"高|中|低","risk":"string","howToReduce":"string"}],"docChecklist":["材料1","材料2"]}],
 "languagePlan":"语言准备建议(针对目标国与该用户)",
 "familyStrategy":"配偶/子女加分与随行策略",
 "actionPlan":{"next3Months":[{"task":"string","expectedImpact":"string"}],"next6Months":[{"task":"string"}],"next12Months":[{"task":"string"}]},
 "planB":"如果主线走不通，退一步的备选方案",
 "familyFriendlySummary":{"summary":"面向全家、通俗的总结","riskExplanation":"主要风险怎么看","budgetAndDecisionAdvice":"预算与决策建议"}
}
profileScan.highlights 2–4 条、redFlags 1–3 条；strengths 2–4 条；weaknesses 2–4 条；factorAdvice 给 2–4 条；countryPlans 覆盖上面列出的国家；keyThresholds/timeline/improvementToQualify 各 2–4 条；costBreakdown 2–5 条。所有内容落到该用户真实背景,具体不重复。` },
  ];
  let out;
  try { out = await chat(messages, { model: MODEL_PRO }); }
  catch (e) {
    console.error("[full-report] Pro 模型(" + MODEL_PRO + ")失败，改用 Fast：", (e && e.message) || e);
    out = await chat(messages, { model: MODEL_FAST });
  }
  if (!out || typeof out !== "object") throw new Error("BAD_SHAPE");
  return out;
}

// ---------- 4) 从追问回答中抽取对结构化字段的更正/补充（让追问回馈到评分） ----------
async function extractCorrections(payload) {
  const p = payload.profile || {};
  const messages = [
    { role: "system", content: RULES },
    { role: "user", content:
`用户先填了表单，又回答了追问。请对比"原始填写"与"追问回答"，找出追问里**明确更正或新补充**、会影响移民竞争力评估的结构化信息。
规则：
1. 只输出确实提到且与原填写不同或更准确的字段；没有变化就不要输出。
2. 不要臆造。
3. englishLevel 必须是以下之一(若用户给了雅思分可映射)：["几乎不会","基础（能日常）","中等（雅思5-6）","良好（雅思6.5-7）","优秀（雅思7.5+）"]。
4. funds 必须是以下之一：["50万以下","50–200万","200–500万","500–1000万","1000万以上"]。
5. occupationInDemand：若用户表明职业在目标国紧缺清单上，输出"是"。

原始填写：
${J(p.fields || {})}

追问问题与回答：
${J({ questions: p.followUpQuestions || [], answers: p.followUpAnswers || {} })}

只输出如下 JSON（仅含需要更正/补充的字段，可缺省）：
{"corrections":{"englishLevel":"","funds":"","expYears":"","occupationInDemand":""}}` },
  ];
  const out = await chat(messages, { model: MODEL_FAST });
  if (!out || typeof out !== "object") throw new Error("BAD_SHAPE");
  return (out.corrections && typeof out.corrections === "object") ? { corrections: out.corrections } : { corrections: {} };
}

module.exports = { chat, followUp, freeResult, fullReport, extractCorrections, MODEL_FAST, MODEL_PRO, BASE };
