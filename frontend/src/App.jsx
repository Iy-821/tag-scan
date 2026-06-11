import { useState, useRef, useCallback } from "react";
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';
import { TEST_IMAGE_BASE64 } from './testImageData';

// ==========================================
// ★ここに取得したAPIキーを貼り付けてください★
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
// ==========================================

const genAI = new GoogleGenerativeAI(API_KEY);

const cropImageFromBase64 = (base64Str) => {
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
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
  });
};

function App() {
  const webcamRef = useRef(null);

  // --- 状態（State）の管理 ---
  const [currentText, setCurrentText] = useState("枠内にタグを合わせてください...");
  const [capturedImage, setCapturedImage] = useState(null);   
  const [photo, setphoto] = useState([]);   
  const [isProcessing, setIsProcessing] = useState(false);
  const [count, setCount] = useState(0);
  
  // 新規追加フラグ
  const [isShooting, setIsShooting] = useState(false); // 0.2秒シャッターの連打防止
  const [showPrintConfirmation, setShowPrintConfirmation] = useState(false); // 印刷画面の表示フラグ
  
  const [productDataList, setProductDataList] = useState([]);
  const [isParsed, setIsParsed] = useState(false);

  const testImagePart = {
    inlineData: { data: TEST_IMAGE_BASE64, mimeType: "image/jpeg" }
  };

  // --- 📸 撮影処理（0.2秒の遅延シャッター） ---
  const handleShutterClick = () => {
    if (isShooting) return;
    setIsShooting(true);

    setTimeout(async () => {
      const imageSrc = webcamRef.current.getScreenshot();
      const image = await cropImageFromBase64(imageSrc);  
      setCapturedImage(image);
      setphoto((prevPhoto) => [...prevPhoto, image]);
      setCount((prevCount) => prevCount + 1);
      setIsShooting(false);
    }, 200); // 0.2秒待機して手ブレを防止！
  };

  const handleContinue = () => {
    setCapturedImage(null); // カメラ画面に戻る
  }

  const handleRetakePreview = () => {
    setCapturedImage(null);
    setCount((prevCount) => prevCount - 1);
    setphoto((prevPhoto) => prevPhoto.slice(0,-1));
  }

  // --- 🔄 印刷後の完全リセット処理 ---
  const handleResetAll = () => {
    setCapturedImage(null);
    setIsParsed(false);
    setShowPrintConfirmation(false);
    setProductDataList([]);
    setphoto([]);
    setCount(0);
    setCurrentText("枠内にタグを合わせてください...");
  };

  // --- 🤖 AI解析処理 ---
  const handleAnalyze = useCallback(async () => {
    setIsProcessing(true);
    setCurrentText("読み取り中♪♪");

    try {
      const imageParts = photo.map((base64Str) => {
        const pureBase64 = base64Str.split(",")[1];
        return { inlineData: { data: pureBase64, mimeType: "image/jpeg" } };
      });

      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });

      const promptStart = `
        あなたはアパレル店舗の在庫管理を支える専門AIです。
        提供された画像から、ラベル印刷に必要な情報を正確に抽出してください。
        複数の画像が入力された場合、送信された画像の順番通りに、それぞれの画像から商品名とサイズを抽出し、必ず以下のような「JSONの配列（リスト形式）」で出力してください。
        【抽出のルール】
        1. 商品名(productName): 「チョーカーツキドロストT」や「チュールビスチェ」のような商品名称を探してください。
        2. サイズ(size): 「SIZE」という項目の横にある「F」や「M」「L」などを探してください。複数のサイズが記載されている場合、それら全てを読み取ってください。
        出力は必ず以下のJSONフォーマットのみで行ってください。
        解説や挨拶は一切不要です。
      `;

      const promptExpectedOutput = `
        [
          {"productName": "ラメソデSRGSSTOPS", "size": "LL F"}
        ]
        【本番】
        ルールは理解できましたね。
        それでは、上記を踏まえて以下の画像を解析し、JSONの配列のみを出力してください。
      `;

      const result = await model.generateContent([
        promptStart, testImagePart, promptExpectedOutput, ...imageParts
      ]);
      
      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

      const data = JSON.parse(text); 
      setProductDataList(data);
      setIsParsed(true); 
      setCurrentText("必要に応じて修正してください。");

    } catch(error){
      console.error("Gemini詳細エラー:", error);
      alert(`エラー: ${error.message}`);
    } finally {
      setIsProcessing(false); 
    }
  }, [photo]);

  const handleChangeData = (index, field, value) => {
    setProductDataList((prevData) => {
      const newData = [...prevData];
      newData[index] = { ...newData[index], [field]: value };
      return newData;
    });
  };

  // ==========================================================
  // 画面の表示ルーティング（状態に合わせて表示する画面を切り替える）
  // ==========================================================
  return (
    <div className="app-container">
      
      {/* ---------------------------------------------------- */}
      {/* 🖨️ 印刷用：A4横幅いっぱいラベル（画面上は見えない）    */}
      {/* ---------------------------------------------------- */}
      <div className="print-only">
        {productDataList.map((item, index) => (
          <div key={index} className="custom-label-container">
            {/* 左上にさりげなく配置する No. */}
            <div className="label-number">No.{index + 1}</div>
            <table className="custom-label-table">
              <tbody>
                <tr>
                  <th>商品名</th>
                  <td>{item.productName}</td>
                  <th>サイズ</th>
                  <td>{item.size}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 📱 アプリUI（印刷時は消える領域）                      */}
      {/* ---------------------------------------------------- */}
      <div className="no-print" style={{ width: '100%', maxWidth: '400px', height: '100vh', margin: '0 auto', backgroundColor: '#121212', color: '#ffffff', position: 'relative', overflow: 'hidden' }}>

        {/* 画面①：印刷確認画面 */}
        {showPrintConfirmation ? (
          <div style={{ padding: '40px 20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>印刷準備完了</h2>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <p style={{ color: '#999', textAlign: 'center' }}>合計 {productDataList.length} 件のラベルを印刷します。</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button onClick={() => window.print()} style={btnStyle('#007bff', '#fff', '18px')}>
                🖨️ 印刷を実行する
              </button>
              <button onClick={() => setShowPrintConfirmation(false)} style={btnStyle('#333', '#fff')}>
                戻って編集する
              </button>
              <button onClick={handleResetAll} style={{...btnStyle('transparent', '#ff4d4f'), border: '1px solid #ff4d4f'}}>
                🔄 印刷が終わったので最初から撮る
              </button>
            </div>
          </div>

        // 画面②：AI解析結果の編集画面
        ) : isParsed ? (
          <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ textAlign: 'center', margin: '10px 0 20px' }}>解析結果</h2>
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
              {productDataList.map((item, index) => (
                <div key={index} style={{ backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '12px', marginBottom: '15px', display: 'flex', gap: '15px' }}>
                  
                  {/* 📷 サムネイル画像（photo配列から同じ番号の画像を引っ張ってくる） */}
                  {photo[index] && (
                    <img src={photo[index]} alt="タグ" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333' }} />
                  )}
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#007bff', fontWeight: 'bold' }}>No.{index + 1}</div>
                    <input 
                      type="text" value={item.productName || ""} 
                      onChange={(e) => handleChangeData(index, "productName", e.target.value)}
                      style={inputStyle} placeholder="商品名"
                    />
                    <input 
                      type="text" value={item.size || ""} 
                      onChange={(e) => handleChangeData(index, "size", e.target.value)}
                      style={{...inputStyle, marginTop: '8px'}} placeholder="サイズ"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <button onClick={() => setIsParsed(false)} style={btnStyle('#333', '#fff')}>戻る</button>
              <button onClick={() => setShowPrintConfirmation(true)} style={{...btnStyle('#007bff', '#fff'), flex: 2}}>
                確定して印刷へ
              </button>
            </div>
          </div>

        // 画面③：撮影直後のプレビュー画面
        ) : capturedImage ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <img src={capturedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '20px 20px 40px', backgroundColor: '#121212', borderRadius: '20px 20px 0 0' }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>{count}枚目を保存しました</h3>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button onClick={handleRetakePreview} style={btnStyle('#333', '#fff')}>撮り直す</button>
                <button onClick={handleContinue} style={{...btnStyle('#333', '#fff'), flex: 2}}>➕ 続けて撮る</button>
              </div>
              <button 
                onClick={handleAnalyze} 
                disabled={isProcessing}
                style={btnStyle(isProcessing ? '#555' : '#007bff', '#fff')}
              >
                {isProcessing ? "AIが解析中..." : `✨ ${count}件の画像を解析する`}
              </button>
            </div>
          </div>

        // 画面④：カメラ起動中（デフォルト画面）
        ) : (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, backgroundColor: '#000' }}>
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'environment' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
              {/* ヘッダー */}
              <div style={{ padding: '20px', paddingTop: '50px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <h1 style={{ textAlign: 'center', margin: 0, fontSize: '20px', letterSpacing: '2px' }}>タグ読みくん</h1>
              </div>

              {/* スキャン枠（ドーナツ穴 ＋ レーザー） */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', width: '260px', height: '260px', boxShadow: '0 0 0 9999px rgba(18, 18, 18, 0.85)', borderRadius: '24px' }}></div>
                <div className="scan-frame">
                  <div className="laser-line"></div>
                </div>
              </div>

              <p style={{ textAlign: 'center', fontSize: '14px', marginBottom: '30px', textShadow: '0 2px 4px #000' }}>
                枠内にスキャンしたいタグを収めてください。
              </p>

              {/* ボトム操作エリア */}
              <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-end', padding: '0 40px 40px', backgroundColor: 'rgba(0,0,0,0.6)', paddingBottom: '60px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '30px', backgroundColor: '#333', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>🖼️</div>
                  <span style={{ fontSize: '12px', marginTop: '8px', color: '#bbb' }}>アルバム</span>
                </div>

                <button 
                  onClick={handleShutterClick} 
                  style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: 'transparent', border: '4px solid #fff', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: isShooting ? '#ccc' : '#fff', transition: '0.2s' }}></div>
                </button>

                <div onClick={photo.length > 0 ? handleAnalyze : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: photo.length > 0 ? 'pointer' : 'not-allowed', opacity: photo.length > 0 ? 1 : 0.5 }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '30px', backgroundColor: '#333', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', position: 'relative' }}>
                    📋
                    {count > 0 && <span style={{position:'absolute', top:'-5px', right:'-5px', background:'#007bff', color:'#fff', width:'24px', height:'24px', borderRadius:'12px', fontSize:'14px', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center'}}>{count}</span>}
                  </div>
                  <span style={{ fontSize: '12px', marginTop: '8px', color: '#bbb' }}>解析へ</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 共通スタイルの定義（JSX内でスッキリさせるため）
const btnStyle = (bg, color, size='16px') => ({
  flex: 1, padding: '16px', borderRadius: '30px', backgroundColor: bg, color: color, fontSize: size, fontWeight: 'bold', border: 'none', cursor: 'pointer'
});
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#333', border: '1px solid #555', borderRadius: '6px', color: '#fff', fontSize: '16px'
};

export default App;