import { useState, useRef, useEffect } from "react";
import Webcam from 'react-webcam';
import './App.css';

// 【変更】Base64文字列ではなく、切り抜き済みの「Canvas要素」そのものを返すようにしました
const getCroppedCanvas = (base64Str) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const cropWidth = img.width * 0.8;
      const cropHeight = img.height * 0.6;
      const startX = (img.width - cropWidth) / 2;
      const startY = (img.height - cropHeight) / 2;

      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      resolve(canvas); // Canvas要素をそのまま渡す
    };
  });
};

function App() {
  const appTitle = "はかりくん (解析テスト)";
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  
  // OpenCVが準備できたかどうかのステータス
  const [isCvReady, setIsCvReady] = useState(false);

  // --- 1. OpenCV.jsのロード完了を待つ ---
  useEffect(() => {
    const checkCv = setInterval(() => {
      // cvオブジェクトと、その中のMatクラスが使えるようになったか判定
      if (window.cv && window.cv.Mat) {
        setIsCvReady(true);
        clearInterval(checkCv);
        console.log("OpenCV is ready!");
      }
    }, 500); // 0.5秒ごとにチェック
    return () => clearInterval(checkCv);
  }, []);

  // --- 2. 1秒ごとのキャプチャ処理 ---
  useEffect(() => {
    if (!isCvReady) return; // OpenCVが準備できるまでは動かさない

    const interval = setInterval(async () => {
      if (!webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // 画像を切り抜いてCanvasを取得
        const croppedCanvas = await getCroppedCanvas(imageSrc);
        // OpenCVで処理
        processWithOpenCV(croppedCanvas);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isCvReady]); // isCvReadyがtrueになったらこのEffectを再実行

  // --- 3. OpenCVを使った画像処理 ---
  const processWithOpenCV = (sourceCanvas) => {
    const cv = window.cv;
    try {
      // Canvasから直接OpenCVのMatに変換（超安定・高速）
      const src = cv.imread(sourceCanvas);
      const dst = new cv.Mat();

      // グレースケール化
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

      // 二値化（白黒反転 ＋ 自動しきい値）
      cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);

      // デバッグ用キャンバスに描画
      cv.imshow(canvasRef.current, dst);

      // メモリ解放（超重要）
      src.delete();
      dst.delete();
    } catch (err) {
      console.error("OpenCVエラーが発生しました:", err);
    }
  };

  return (
      <div className="no-print" style={{ textAlign: 'center', padding: '20px' }}>
        <h1>{appTitle}</h1>
        
        {/* ロード中の警告表示 */}
        {!isCvReady && <p style={{ color: 'red', fontWeight: 'bold' }}>OpenCVを読み込み中...</p>}

        <div style={{ margin:'20px auto', maxWidth: '800px', border: '4px solid #333', borderRadius:'8px', overflow:'hidden', position: 'relative' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            forceScreenshotSourceSize={true}
            style={{ width:'100%', display: 'block' }}
            videoConstraints={{ 
              facingMode:'environment',
              width:{ideal:1920},
              height:{ideal:1920},
              frameRate:{ideal:30}
            }}
          />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%', height: '60%',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            border: '2px solid #393d44',
            zIndex: 10
          }}></div>
        </div>

        <h2>解析プレビュー (二値化)</h2>
        <div style={{ margin: '20px auto', maxWidth: '800px', border: '2px dashed #999', minHeight: '200px' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }}></canvas>
        </div>
      </div>
  );
}

export default App;