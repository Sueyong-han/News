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
let GapiKey = "AIzaSyA1HEYUYD8-DxONWcDmho-9qrtV24w65Io";
const GapiKeyOne = "AIzaSyCQc1vU97U6A-zK_VImKFUuaNYkzVhqGG8";//suyeongh584
const GapiKeyTwo = "AIzaSyA1HEYUYD8-DxONWcDmho-9qrtV24w65Io"; //gnd81967
const GapiKeyThree = "AIzaSyC0AoiB_U6Vu19eJGw8bTGsVoD-qYtdTxk"; //suyeong090928
const Gendpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GapiKey}`;

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

// ==========================================
// 핵심 로직 함수
// ==========================================
export async function analyzeNews(where) {
    let ExDate = [""];
    let titles = [];
    let finTitles = [];
    let finNews = [];

    const naverClient = axios.create({
        headers: {
            'X-Naver-Client-Id': NaverClientId,
            'X-Naver-Client-Secret': NaverClientSecret
        }
    });

    const geminiClient = axios.create({
        headers: {
            'Authorization': `Bearer ${GapiKey}`,
            'Content-Type': 'application/json'
        }
    });

    for (const hw of howList) {
        const query = `서울 ${where} ${hw}`;
        const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&sort=sim&display=${ddplay}&start=1`;

        try {
            const response = await naverClient.get(url);
            const items = response.data.items;

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

            filteredItems.forEach(item => titles.push(item.title || ""));

            const tasks = filteredItems.map(async (item) => {
                try {
                    const title = item.title || "";
                    const link = item.link || "";
                    const desc = item.description || "";
                    const date = item.pubDate || "";
                    
                    let MyCase = [];
                    let HowWhenWhere = [];
                    let When = "nah";
                    let together = false;
                    let JungBok = false;
                    let Silkyeok = false;
                    let JungBokTitles = [];

                    const allTitlesStr = titles.join(", '");
                    const prompt = `"${desc} 기사 날짜: ${date}" 이 내용과 인터넷을 보고 이 내용이 소설의 내용이라면 XX만 출력하고 아니면, 범죄 종류와 날짜, 위치를 두서없이 '범죄 종류: (살인, 절도, 강도, 성범죄, 교통사고 중 하나로) | 범죄 날짜: - | 범죄 위치: --시 --구 --동 '이런 식으로 나타내. 또한, 범행날짜가 ${minYear}년도 전의 일이면 범행날짜와 X를 출력해, '${title}'을 제외한 '${allTitlesStr}'의 제목들 중 이 뉴스와 사건이 조금이라도 비슷한 것 같으면 중복기사들의 제목을 '| 중복 기사: -,-,-'형식으로 추가로, 그리고 '| JungBok!'도 추가로 출력해. 날짜를 정확히 yyyy년 mm월 dd일 형식으로 작성해(ex. 2022년 02월 03일)!! 그리고 내가 시킨 형식이외의 다른 말은 절대로 하지말고 날짜 중 모르는건 _ 로 표시해(ex. 2024년 __월 __일). 범죄 종류 모르겠으면 그냥 XX만 출력해.`;

                    const requestBody = {
                    "contents": [
                        {
                        "role": "user",
                        "parts": [{ "text": "your prompt" }]
                        }
                    ]
                    };
                    const gResponse = await axios.post(Gendpoint, requestBody, {
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                    const message = gResponse.data.candidates[0].content.parts[0].text;

                    if (message.includes("XX")) { Silkyeok = true; }

                    const HWW = message.split('|').map(x => x.trim()).filter(x => x !== "");
                    HWW.forEach(factor => {
                        const parts = factor.split(':', 2);
                        if (parts.length > 1) HowWhenWhere.push(parts[1].trim());
                    });

                    if (HWW.length >= 4) {
                         const jParts = HWW[3].split(':');
                         if(jParts.length > 1) {
                             const jTitles = jParts[1].split(',').map(x => x.trim()).filter(x => x !== "");
                             JungBokTitles.push(...jTitles);
                         }
                    }

                    if (HowWhenWhere.length >= 2) {
                        When = HowWhenWhere[1];
                        if (ExDate.includes(When)) { together = true; } else { together = false; }
                        if (message.includes("JungBok")) { JungBok = true; } else { JungBok = false; }
                        ExDate.push(When);

                        const parsedDate = parseKoreanDate(When);
                        if (parsedDate && parsedDate.getFullYear() < minYear) {
                            Silkyeok = true;
                            ExDate = ExDate.filter(d => d !== When);
                        }

                        const cleanTitle = title.replace(/<\/?b>/g, "");
                        MyCase.push(cleanTitle);
                        MyCase.push(link);
                        MyCase.push(desc);
                        MyCase.push(HowWhenWhere[0] || "");
                        MyCase.push(HowWhenWhere[1] || "");
                        MyCase.push(HowWhenWhere[2] || "");

                        if (JungBok) {
                            const isAlreadyInFin = finTitles.includes(cleanTitle);
                            const isReferencedAsJungBok = finTitles.some(ft => JungBokTitles.includes(ft));
                            if (!isReferencedAsJungBok && !isAlreadyInFin && !together && !Silkyeok) {
                                finTitles.push(cleanTitle);
                                finNews.push(MyCase);
                            }
                        }

                        if (!JungBok && !together && !Silkyeok) {
                            finTitles.push(cleanTitle);
                            finNews.push(MyCase);
                        }
                    }
                } catch (ex) {
                    console.error(`Item Error: ${ex.message}`);
                    if(ex.message == "Request failed with status code 403" && Roop < 2)
                    {
                      if(GapiKey == GapiKeyOne) GapiKey = GapiKeyTwo;
                      else if(GapiKey == GapiKeyTwo) GapiKey = GapiKeyThree;
                      else if(GapiKey == GapiKeyThree) GapiKey = GapiKeyOne;
                      Roop = Roop + 1;
                      console.log("Roop!");
                      return;
                    }
                    if(ex.message.includes(`Request failed with status code 429`)) 
                    {sleep(500);
                    }
                }
            });

            await Promise.all(tasks);
        } catch (e) {
            console.error(`Batch Error: ${e.message}`);
            
        }
    }
    return finNews;
    Roop = 0;
    //fdfdfdf
    //jj

}
