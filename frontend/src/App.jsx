import { useState, useRef, useEffect } from "react";
import Webcam from 'react-webcam';
import './App.css';

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

      resolve(canvas);
    };
  });
};

function App() {
  const appTitle = "はかりくん (位置調整モード)";
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [isCvReady, setIsCvReady] = useState(false);

  // --- 【追加】ユーザーが変更できる設定項目（State） ---
  const [targetWeight, setTargetWeight] = useState(120); // 目標のグラム数
  
  // 判定枠の位置・サイズ調整用（初期値は適当な真ん中あたり）
  const [boxX, setBoxX] = useState(150);      // 1桁目のX座標
  const [boxY, setBoxY] = useState(100);      // 全ての桁のY座標
  const [boxW, setBoxW] = useState(60);       // 1つの桁の横幅
  const [boxH, setBoxH] = useState(100);      // 1つの桁の縦幅
  const [boxGap, setBoxGap] = useState(20);   // 桁と桁の間の隙間
  const [digitCount, setDigitCount] = useState(3); // 桁数（120gなら3桁、0.0gなら4桁など）

  useEffect(() => {
    const checkCv = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        setIsCvReady(true);
        clearInterval(checkCv);
        console.log("OpenCV is ready!");
      }
    }, 500);
    return () => clearInterval(checkCv);
  }, []);

  useEffect(() => {
    if (!isCvReady) return;

    const interval = setInterval(async () => {
      if (!webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const croppedCanvas = await getCroppedCanvas(imageSrc);
        processWithOpenCV(croppedCanvas);
      }
    }, 500); // 位置合わせをスムーズにするため0.5秒周期に加速

    return () => clearInterval(interval);
  }, [isCvReady, boxX, boxY, boxW, boxH, boxGap, digitCount]); // 設定が変わったらループを即更新

  const processWithOpenCV = (sourceCanvas) => {
    const cv = window.cv;
    try {
      const src = cv.imread(sourceCanvas);
      const dst = new cv.Mat();

      // 1. グレースケール化と二値化
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
      cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);

      // 2. 二値化画像の上に「判定枠」を描画して確認できるようにする
      // 白黒画像なので、枠線はグレー（128）で描画します
      for (let i = 0; i < digitCount; i++) {
        // 各桁のX座標を計算（左から右に並べる）
        const x = boxX + i * (boxW + boxGap);
        
        const point1 = new cv.Point(x, boxY);
        const point2 = new cv.Point(x + boxW, boxY + boxH);
        const color = new cv.Scalar(128, 128, 128, 255); // グレーの線
        
        // 四角形を描画 (画像, 左上座標, 右下座標, 色, 線の太さ)
        cv.rectangle(dst, point1, point2, color, 2);
      }

      // デバッグ用キャンバスに描画
      cv.imshow(canvasRef.current, dst);

      src.delete();
      dst.delete();
    } catch (err) {
      console.error("OpenCVエラー:", err);
    }
  };

  return (
      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <h1>{appTitle}</h1>
        {!isCvReady && <p style={{ color: 'red', fontWeight: 'bold' }}>OpenCVを読み込み中...</p>}

        {/* コントロールパネル */}
        <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', maxWidth: '800px', margin: '0 auto 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'left' }}>
          <h3>🛠️ 設定コントロール</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold' }}>🎯 目標重量: </label>
            <input 
              type="number" 
              value={targetWeight} 
              onChange={(e) => setTargetWeight(Number(e.target.value))}
              style={{ width: '80px', fontSize: '16px', padding: '4px', marginLeft: '10px' }}
            /> g
          </div>

          <hr />
          <p style={{ fontSize: '12px', color: '#666' }}>※下の「解析プレビュー」を見ながら、グレーの枠がはかりの数字にぴったり重なるように調整してください。</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label>左右位置 (X): {boxX}</label><br />
              <input type="range" min="0" max="800" value={boxX} onChange={(e) => setBoxX(Number(e.target.value))} style={{ width: '90%' }} />
            </div>
            <div>
              <label>上下位置 (Y): {boxY}</label><br />
              <input type="range" min="0" max="600" value={boxY} onChange={(e) => setBoxY(Number(e.target.value))} style={{ width: '90%' }} />
            </div>
            <div>
              <label>枠の横幅: {boxW}</label><br />
              <input type="range" min="10" max="200" value={boxW} onChange={(e) => setBoxW(Number(e.target.value))} style={{ width: '90%' }} />
            </div>
            <div>
              <label>枠の縦幅: {boxH}</label><br />
              <input type="range" min="10" max="300" value={boxH} onChange={(e) => setBoxH(Number(e.target.value))} style={{ width: '90%' }} />
            </div>
            <div>
              <label>文字の間隔: {boxGap}</label><br />
              <input type="range" min="0" max="100" value={boxGap} onChange={(e) => setBoxGap(Number(e.target.value))} style={{ width: '90%' }} />
            </div>
            <div>
              <label>表示する桁数: {digitCount}桁</label><br />
              <select value={digitCount} onChange={(e) => setDigitCount(Number(e.target.value))} style={{ padding: '4px', width: '90%' }}>
                <option value={2}>2桁</option>
                <option value={3}>3桁 (120gなど)</option>
                <option value={4}>4桁 (0.0gなど)</option>
              </select>
            </div>
          </div>
        </div>

        {/* カメラ映像（ガイド枠付き） */}
        <div style={{ margin:'20px auto', maxWidth: '600px', border: '4px solid #333', borderRadius:'8px', overflow:'hidden', position: 'relative' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            forceScreenshotSourceSize={true}
            style={{ width:'100%', display: 'block' }}
            videoConstraints={{ 
              facingMode:'environment',
              width:{ideal:1280},
              height:{ideal:720}
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

        {/* OpenCV解析プレビュー */}
        <h2>解析プレビュー (二値化 ＆ 判定枠)</h2>
        <div style={{ margin: '20px auto', maxWidth: '600px', border: '2px dashed #999', backgroundColor: '#000' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }}></canvas>
        </div>
      </div>
  );
}

export default App;