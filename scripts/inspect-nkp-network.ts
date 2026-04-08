import { chromium } from "playwright";

const lessonUrl = "https://www.nkp.hu/tankonyv/irodalom_5_nat2020/lecke_01_010";

function isInteresting(url: string) {
  return (
    url.includes("nkp.hu") &&
    (url.includes("/api/") ||
      url.includes("get_book_") ||
      url.includes("getChapterLessons") ||
      url.includes("view_lesson") ||
      url.includes("view_book") ||
      url.includes("view_chapter"))
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const seen = new Set<string>();

  page.on("request", (request) => {
    const url = request.url();
    const key = `REQ ${request.method()} ${url}`;

    if (!isInteresting(url) || seen.has(key)) {
      return;
    }

    seen.add(key);
    console.log(key);
    if (request.method() !== "GET") {
      console.log(`REQ_BODY ${request.postData() ?? ""}`);
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    const key = `RES ${response.status()} ${url}`;

    if (!isInteresting(url) || seen.has(key)) {
      return;
    }

    seen.add(key);
    console.log(key);

    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
      return;
    }

    try {
      const text = await response.text();
      console.log(`RES_BODY ${text.slice(0, 1200)}`);
    } catch (error) {
      console.log(`RES_BODY_ERROR ${String(error)}`);
    }
  });

  await page.goto(lessonUrl, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await page.waitForTimeout(3_000);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
