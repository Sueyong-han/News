import axios from "axios";

export async function analyzeNews(where) {
  // ===== 설정 =====
  let ddplay = 10;
  let howList = ["살인", "절도", "강도", "강간", "교통사고"];
  let exclude = ["캄보디아", "뉴진스"];
  let minYear = 2015;

  let titles = [];
  let finTitles = [];
  let finNews = [];
  let ExDate = [""];
  let together = [""];

  const NaverClientId = "huZd7zaib4TwzKeL1CTf";
  const NaverClientSecret = "_U1v0LcMmI";

  const GapiKey = "AIzaSyCQc1vU97U6A-zK_VImKFUuaNYkzVhqGG8";
  const Gendpoint =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

  // ===== 메인 반복 =====
  for (let hw of howList) {
    let ExDate = [""];
    const query = `${where} ${hw}`;
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
      query
    )}&sort=sim&display=${ddplay}&start=1`;
    
    await new Promise(res => setTimeout(res, 500));
    try {
      // 1) 네이버 뉴스 요청
      let response = await axios.get(url, {
        headers: {
          "X-Naver-Client-Id": NaverClientId,
          "X-Naver-Client-Secret": NaverClientSecret,
        },
      });

      let items = response.data.items.filter((item) => {
        let title = item.title || "";
        let desc = item.description || "";
        let pubdate = new Date(item.pubDate);

        // exclude 필터
        let hasExcluded = exclude.some(
          (w) =>
            title.toLowerCase().includes(w.toLowerCase()) ||
            desc.toLowerCase().includes(w.toLowerCase())
        );
        if (hasExcluded) return false;

        // 연도 필터
        return pubdate.getFullYear() > minYear;
      });

      // ===== 2) Gemini 호출 (순차 실행) =====
      for (let item of items) {
        let title = (item.title || "").replace(/<b>|<\/b>/g, "");
        let desc = item.description || "";
        let link = item.link || "";
        let date = item.pubDate || "";

        titles.push(title);

        const prompt = `"${desc} 기사 날짜: ${date}" 이 내용과 인터넷을 보고 이 내용이 소설의 내용이거나 실제로 일어난것이 아닌 비유적인 표현이라면 XX만 출력하고 아니면, 범죄 종류와 날짜, 위치를 두서없이 '범죄 종류: ... | 범죄 날짜: ... | 범죄 위치: --시 --구 --동 ' 이런 식으로 나타내. 또한, 너가 나타낸 범죄 위치가 ${where}과 상관없다면 XX만 출력해`;

        const body = {
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a helpful news analyzer." },
            { role: "user", content: prompt },
          ],
        };

        let gRes = await axios.post(Gendpoint, body, {
          headers: {
            Authorization: `Bearer ${GapiKey}`,
            "Content-Type": "application/json",
          },
        });

        let message =
          gRes.data.choices?.[0]?.message?.content || "XX | 분석 실패";

        let isXX = message.includes("XX");

        // '|' 단위 파싱
        if(!isXX){
        let parts = message.split("|").map((p) => p.trim());

        let How = parts[0]?.split(":")[1]?.trim() ?? "";
        let When = parts[1]?.split(":")[1]?.trim() ?? "";
        let Where = parts[2]?.split(":")[1]?.trim() ?? "";

        let JungBok = message.includes("JungBok");
        together = ExDate.includes(When);
        ExDate.push(When);
        }

        if (!isXX && !together) {
          finTitles.push(title);
          finNews.push([title, link, desc, How, When, Where]);
        }
      }
    } catch (err) {
      console.error("네이버 오류: ", err.message);
    }
    console.warn(`${hw} 분석 완료`);
  }

  return finNews;
}

