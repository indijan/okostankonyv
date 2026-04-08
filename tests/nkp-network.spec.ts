import { test } from "playwright/test";

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

test("inspect NKP lesson network traffic", async ({ page }) => {
  const seen = new Set<string>();

  page.on("request", (request) => {
    const url = request.url();

    if (!isInteresting(url) || seen.has(`REQ ${request.method()} ${url}`)) {
      return;
    }

    seen.add(`REQ ${request.method()} ${url}`);
    console.log(`REQ ${request.method()} ${url}`);
    if (request.method() !== "GET") {
      console.log(`REQ_BODY ${request.postData() ?? ""}`);
    }
  });

  page.on("response", async (response) => {
    const url = response.url();

    if (!isInteresting(url) || seen.has(`RES ${response.status()} ${url}`)) {
      return;
    }

    seen.add(`RES ${response.status()} ${url}`);
    console.log(`RES ${response.status()} ${url}`);

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
});
