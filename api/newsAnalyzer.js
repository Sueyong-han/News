import axios from 'axios';

// ==========================================
// 설정 및 변수
// ==========================================
const ddplay = 10;
const howList = ["살인", "강도", "절도", "성범죄", "교통사고"];
const exclude = ["캄보디아", "뉴진스"];
const minYear = 2015;

var Roop = 0;

// 환경 변수에서 키 가져오기 (Render 대시보드에서 설정 예정)
const NaverClientId = "huZd7zaib4TwzKeL1CTf";
const NaverClientSecret = "_U1v0LcMmI";
let GapiKey = "AIzaSyCyOTy446Hn217FGgUU14iaJrSC9bEAj6g";
const GapiKeyOne = "AIzaSyAOt71PFgIDYPkaoAHnd14lb75JGhhSVEw";//suyeongh584 AIzaSyBC-rNwAOI_glh0C5V0hV-tYBVuVj1NEFs
const GapiKeyTwo = "AIzaSyAChnr7yu0t8xwnMMQPEpF8l2MJhmNiSAs"; //gnd81967 AIzaSyDhdZ_3w310UEPlDb_lqTbYg-3etHRLu2I
const GapiKeyThree = "AIzaSyAOt71PFgIDYPkaoAHnd14lb75JGhhSVEw"; //suyeong090928 AIzaSyCnaBnSPSUBtWqwTu0lqtPNqzltM8g_lFk
var Gendpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GapiKey}`;

// ==========================================
// 유틸리티 함수
// ==========================================
function parseKoreanDate(dateStr) {
    try {
        let cleanStr = dateStr.replace(/__/g, "01").trim();
        const parts = cleanStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (parts) {
            return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        }
        return null;
    } catch (e) {
        return null;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// rotate GapiKey in cycle
function rotateKey() {
    if (GapiKey === GapiKeyOne) GapiKey = GapiKeyTwo;
    else if (GapiKey === GapiKeyTwo) GapiKey = GapiKeyThree;
    else if (GapiKey === GapiKeyThree) GapiKey = GapiKeyOne;
    Gendpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GapiKey}`;
}

// ==========================================
// 핵심 로직 함수
// ==========================================
export async function analyzeNews(where) {
    let ExDate = [""];
    let finTitles = [];
    let finNews = [];

    const naverClient = axios.create({
        headers: {
            'X-Naver-Client-Id': NaverClientId,
            'X-Naver-Client-Secret': NaverClientSecret
        }
    });

    // note: geminiClient is not used because we send key in URL per-request

    for (const hw of howList) {
        const query = `서울 ${where} ${hw}`;
        const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&sort=sim&display=${ddplay}&start=1`;

        try {
            const response = await naverClient.get(url);
            const items = response.data.items || [];

            const filteredItems = items.filter(item => {
                const title = item.title || "";
                const desc = item.description || "";
                const pubDate = new Date(item.pubDate);
                const hasExclude = exclude.some(word => 
                    title.toLowerCase().includes(word.toLowerCase()) || 
                    desc.toLowerCase().includes(word.toLowerCase())
                );
                const isOld = pubDate.getFullYear() <= minYear;
                return !hasExclude && !isOld;
            });
            let titles = [];
            let links = [];
            let desc = [];
            let date = [];
            filteredItems.forEach(item => titles.push(item.title || ""));
            filteredItems.forEach(item => links.push(item.link || ""));
            filteredItems.forEach(item => desc.push(item.description || ""));
            filteredItems.forEach(item => date.push(item.pubDate || ""));
            let NewsInfrom = ""
            for(let i = 0; i < titles.length; i++)
            {NewsInfrom = NewsInfrom + "\n" + `제목: ${titles[i]} || 링크: ${links[i]} || 요약: ${desc[i]} || 기사 발간 날짜: ${date[i]}`; }
            // === sequential processing to avoid 429 ===
            try {
                let MyCase = [];
                let HowWhenWhere = [];
                let When = "nah";
                let together = false;
                let JungBok = false;
                let Silkyeok = false;
                let JungBokTitles = [];

                const allTitlesStr = titles.join(", '");
                const prompt = `너는 유용한 뉴스 분석가야. 다음의 형식을 지켜서 대답해.
                        1) json배열의 형식으로 대답할것.
                        [
                        {
                        title:"..." <-- 이건 제목
                        description:"..." <--이건 요약
                        link:"..." <--이건 내가 준 링크 그대로 작성할것
                        CrimeKind:"..." <-- 이건 범죄유형(살인,절도,강도, 강간, 교통사고 중 하나. 이중에 없다면 그냥 XX를 작성할것)
                        Date:"..." <-- 이건 뉴스를 보고 추정한 범죄 발생 날짜(정확히 0000년 00월 00일 로 작성할것)
                        duplication:["...","..."...] <-- 이건 '${allTitlesStr}'의 제목들 중 이 뉴스와 사건이 조금이라도 비슷한 것 같으면 그 중복기사들의 제목
                        Location: "..." <--이건 뉴스를 보고 추정한 범죄 발생 위치(정확히 ...시 ...구 ...시 로 작성할것, 모른다면 ${where}이라 작성할것)
                        IsReal: ... <-- 이건 뉴스의 사건이 실제로 일어난 사건인 것 같으면 true, 소설이나 예능처럼 실제로 일어나지 않은 사건인 것 같으면 false를 작성.
                        }
                        ]

                        gemini야, 이 뉴스들을 분석해줘
                        ${NewsInfrom}
                        `;
                const requestBody = {
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }]
                        }
                    ]
                };

                // Try up to 3 attempts per item, rotating key on 403, backoff on 429
                let attempt = 0;
                let message = "";
                let success = false;

                while (attempt < 3 && !success) {
                    try {
                        const gResponse = await axios.post(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GapiKey}`,
                            requestBody,
                            { headers: { "Content-Type": "application/json" }, timeout: 60000 }
                        );

                        message = (gResponse.data && gResponse.data.candidates && gResponse.data.candidates[0] && gResponse.data.candidates[0].content && gResponse.data.candidates[0].content.parts && gResponse.data.candidates[0].content.parts[0] && gResponse.data.candidates[0].content.parts[0].text) || "";
                        success = true;
                    } catch (err) {
                        const msg = err && err.message ? err.message : String(err);
                        console.error(`Gemini request error (attempt ${attempt + 1}): ${msg}`);

                        if (msg.includes('status code 403') || msg.includes('403')) {
                            // rotate key and try again once
                            rotateKey();
                            Roop = Roop + 1;
                            console.log('Rotated key due to 403, Roop=', Roop);
                            attempt++;
                            // small delay before retry
                            await sleep(200);
                            continue;
                        }

                        if (msg.includes('status code 429') || msg.includes('429') || msg.includes('Too Many Requests')) {
                            // backoff and retry
                            await sleep(500 + attempt * 300);
                            attempt++;
                            continue;
                        }

                        // other errors -> break attempts and skip this item
                        console.error('Non-retryable Gemini error, skipping item:', msg);
                        break;
                    }
                }

                if (!success || !message) {
                    console.error('Item Error: failed to get valid response from Gemini for this item');
                    continue; // skip this item
                }
                const jsonStart = message.indexOf('[');
                const jsonEnd = message.lastIndexOf(']') + 1;
                // message에서 JSON 배열 부분만 가져오기
                const jsonString = message.substring(jsonStart, jsonEnd);

                const messageData = JSON.parse(jsonString);
                
                for(var i = 0; i < titles.length; i++)
                {
                    messageData[i].title = messageData[i].title.replace(/<\/?b>/g, "");
                    messageData[i].description = messageData[i].description.replace(/<\/?b>/g, "");
                    if(messageData[i].CrimeKind.includes("XX")) messageData[i].IsReal = false;
                    if(messageData[i].IsReal == true)
                        {
                            if(messageData[i].duplication.length > 0)
                            {
                                if(!messageData[i].duplication.some(element => finTitles.includes(element)))
                                {
                                finTitles.push(messageData[i].title);
                                finNews.push(messageData[i]);
                                }
                            }
                            else{
                                finTitles.push(messageData[i].title);
                                finNews.push(messageData[i]);
                            }
                        } 
                }
            
                // small pause to avoid hitting rate limits
                await sleep(150);

            } catch (ex) {
                console.error(`Item Error: ${ex.message}`);
                // keep behavior: don't recursively call analyzeNews; log and continue
                if(ex.message == "Request failed with status code 403" && Roop < 2)
                {
                    rotateKey();
                    Roop = Roop + 1;
                    console.log("Roop!");
                    // don't call analyzeNews recursively
                    continue;
                }
                if(ex.message == "Request failed with status code 403" && Roop > 3) continue;
                if(ex.message.includes(`Request failed with status code 429`)) 
                {await sleep(500); continue;}
            }
        

        } catch (e) {
            console.error(`Batch Error: ${e.message}`);
        }
        console.log(`${hw} 분석 완료`);
    }
    Roop = 0;
    return finNews;
}
export async function AIfeeback(quest) {
    // 1. 요청 본문 (Request Body) 구성
    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: quest }]
            }
        ]
    };
    
    console.log(`[Gemini 호출] ${userPrompt} ...`);
    
    try {
        // 2. Axios를 사용하여 POST 요청 전송
        const response = await axios.post(
            Gendpoint,  // 구성된 API Endpoint URL
            requestBody,
            { 
                headers: { "Content-Type": "application/json" },
                timeout: 60000 // 타임아웃 60초 설정
            }
        );

        // 3. 응답에서 텍스트 결과 추출
        const candidate = response.data?.candidates?.[0];
        const resultText = candidate?.content?.parts?.[0]?.text;

        if (resultText) {
            console.log("✅ API 호출 성공");
            return resultText.trim();
        }
    }
    catch(e)
    {
        console.log(e);
    }
}
