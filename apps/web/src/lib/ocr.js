/* ============================================================
   ocr.js — 결과지 사진에서 글자 뽑기

   ★ 이 파일이 하는 일은 전부 브라우저 안에서 끝난다. ★
   이미지는 네트워크로 나가지 않는다. tesseract.js 가 wasm 으로
   기기에서 돌고, 결과 텍스트는 파서로 넘어간 뒤 버려진다.

   서버 OCR 을 쓰면 편하지만, 그 순간 민감정보 이미지를 남의 서버에
   보내는 구조가 된다. 그 편의를 사지 않기로 했다.
   ============================================================ */

let workerPromise = null;

/** tesseract 는 수 MB 다. 체성분 화면에 들어올 때만 받는다. */
async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker(['kor', 'eng'], 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
        },
      });
    })();
  }
  return workerPromise;
}

/**
 * 결과지 이미지에서 텍스트를 뽑는다.
 * @param {File|Blob|HTMLCanvasElement} image
 * @param {(p:number)=>void} onProgress 0~1
 * @returns {Promise<string>}
 */
export async function readSheet(image, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  return data.text || '';
}

/** 촬영 이미지를 인식하기 좋게 손본다.
    긴 변 1600px 로 줄이고 대비를 올린다. 흑백 인쇄물이라 이 정도면 충분하다. */
export async function preprocess(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // 그레이스케일 후 대비 강화 (중간톤을 밀어낸다)
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = g < 128 ? Math.max(0, (g - 40) * 1.6) : Math.min(255, 40 + (g - 40) * 1.6);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  bitmap.close?.();
  return canvas;
}
