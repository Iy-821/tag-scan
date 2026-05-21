//インポート
import { useState ,useRef, useCallback } from "react";
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';

// ==========================================
// ★ここに取得したAPIキーを貼り付けてください★
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
// ==========================================

//URL:http://localhost:5173

const genAI = new GoogleGenerativeAI(API_KEY);

// 【追加】画像を切り抜くための関数
const cropImageFromBase64 = (base64Str) => {
  // 1. Promise（プロミス）：画像処理は時間がかかるので、「終わるまで待っててね」という約束（非同期処理）を作ります。
  return new Promise((resolve) => {
    
    // 2. メモリ上に、見えない <img> タグを作ります。
    const img = new Image();
    
    // 3. その <img> タグに、カメラで撮った画像データ（長い文字列）を読み込ませます。
    img.src = base64Str;
    
    // 4. onload = 「画像の読み込みが完全に終わったら、次の処理をしてね」という指示。
    img.onload = () => {
      
      // 5. メモリ上に、見えない <canvas>（お絵描きボード）を作ります。
      const canvas = document.createElement('canvas');
      
      // 6. 切り抜きたいサイズを計算（元の横幅の80%、縦幅の30%）
      const cropWidth = img.width * 0.8;
      const cropHeight = img.height * 0.6;
      
      // 7. 切り抜くスタート位置（左上の座標 X, Y）を計算。全体から切り抜きサイズを引いて半分にすると、ド真ん中になります。
      const startX = (img.width - cropWidth) / 2;
      const startY = (img.height - cropHeight) / 2;

      // 8. キャンバス自体の大きさを、切り抜きサイズに合わせます。
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // 9. キャンバスに絵を描くための「筆（コンテキスト）」を用意します。
      const ctx = canvas.getContext('2d');

      // 10. 筆を使って、元の画像をキャンバスに描きます（ここでハサミで切り取る処理が行われます）。
      // drawImage(画像, 元画像の切り抜き開始X, Y, 切り抜く幅, 高さ, キャンバスの描画開始X, Y, 描画する幅, 高さ)
      ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // 11. 切り抜き終わったキャンバスの絵を、再び Base64（文字列）に戻します。
      // 第2引数の '0.5' は、JPEGの画質を50%に落としてデータ容量を軽くする（圧縮する）指示です。
      // resolve(...) で、「約束（Promise）の処理が終わったよ！この画像を返すよ！」と報告します。
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

function App() {
  const appTitle = "タグ読みくん";
  const webcamRef = useRef(null);

  // --- 状態（State）の管理 ---
  const [currentText, setCurrentText] = useState("枠内にタグを合わせてください...");
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  //AIから受け取ったデータを管理する構造体
  const [productData, setProductData] = useState({
    productName: "",
    size: ""
  });

  //解析が成功したかどうかを判定するフラグ
  const [isParsed, setIsParsed] = useState(false);

  // --- 撮影処理 ---
  const handleCaptured = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot(); //変数imageSrcがスクショ
    const croppedImage = await cropImageFromBase64(imageSrc); //関数によって切り取った写真をcroppedImageに代入
    setCapturedImage(croppedImage); //usestate
    analyzeWithGemini(croppedImage);  //関数
  }, [webcamRef]);

  // --- AI解析処理 ---
  const analyzeWithGemini = async (base64Image) => {
    // 処理中フラグをON
    setIsProcessing(true);
    setCurrentText("読み取り中♪♪");

    //tips表示

    setIsParsed(false); // 印刷フォームを一旦隠す（下の方に書いてある印刷フォームのオンオフに関わる）

    try {
      // 1. GoogleのAIは最初の "data:image/jpeg;base64," の部分は不要なので、カンマ (,) で分割して、後ろの純粋なデータ部分 [1] だけを取り出します。
      const base64Data = base64Image.split(",")[1];
      
      // 2. AIに渡すための「画像パーツ」の設計図を作ります。
      const imagePart = {
        inlineData: { data: base64Data, mimeType: "image/jpeg" },
      };

      // 3. AIモデルの呼び出し設定。「3.1-flash-lite」を使い、返事は必ず「JSON形式」にするよう強制（generationConfig）します。
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });

      // 4. プロンプト（指示文）。ここでJSONのキー名（productName等）を指定しておくことが超重要です。
      //product codeを抜いた
      const prompt = `
        あなたはアパレル店舗の在庫管理を支える専門AIです。
        提供された画像から、ラベル印刷に必要な情報を正確に抽出してください。
        
        【抽出のルール】
        1. 商品名(productName): 「チョーカーツキドロストT」や「チュールビスチェ」のような商品名称を探してください。
        2. サイズ(size): 「SIZE」という項目の横にある「F」や「M」「L」などを探してください。

        出力は必ず以下のJSONフォーマットのみで行ってください。
        解説や挨拶は一切不要です。

        {
          "productName": "見つかった商品名",
          "size": "見つかったサイズ"
        }
      `;

      // 5. AIに画像と指示を送り、返事が来るまで待機（await）します。
      const result = await model.generateContent([prompt, imagePart]);  //generateContent([prompt, imagePart])が投げている部分
      const response = await result.response;
      let text = response.text(); // AIの返事を文字列として取り出す
      
      // 6. 正規表現（/ /g）という手法を使って、AIが勝手につけた ```json などの余計な文字を空文字("")に置き換えて（replace）、前後の空白を削除（trim）します。
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

      // 7. 文字列（ただの文字の羅列）を、JavaScriptが操作できる「JSONオブジェクト（データの塊）」に変換（パース）します。
      const data = JSON.parse(text); 
      
      // 8. 変換したデータをStateに保存します。これで画面のフォームに文字が入ります。
      setProductData(data); //構造体にデータが入る
      setIsParsed(true); 
      setCurrentText("必要に応じて修正してください。");

    } catch(error){
      console.error("Gemini詳細エラー:", error);
      setCurrentText(`エラー: ${error.message}`);
    } finally {
      setIsProcessing(false); 
    }
  };

  // --- 撮り直し処理 ---
  const handleRetake = () => {
    setCapturedImage(null);
    setIsParsed(false); // フォームを隠す
    setProductData({ productName: "", size: "" }); // データを空に戻す
    setCurrentText("枠内にタグを合わせてください...");
  }

  // --- 画面の表示（JSX） ---
  return (
    <>
    <div className="no-print" style={{ textAlign: 'center', padding: '20px' }}>
      <h1>{appTitle}</h1>

      <div style={{ margin:'20px auto', maxWidth: '1600px', border: '4px solid #333', borderRadius:'8px', overflow:'hidden', position: 'relative' }}>
        {!capturedImage && (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              style={{ width:'100%', display: 'block' }}
              videoConstraints={{ facingMode:'environment' }}
            />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%', height: '60%',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              border: '2px solid #393d44',
              zIndex: 10
            }}></div>
          </>
        )}
        {capturedImage && (
          <img src={capturedImage} alt="切り取られた写真" style={{ width: '100%', display: 'block', backgroundColor: '#000' }} />
        )}
      </div>

      <div style={{ margin: '20px', padding: '10px', border: '1px solid black' }}>
        <p>ステータス：{currentText}</p>
      </div>

      {/* ★今回のメイン：解析成功時（isParsedがtrue）に表示される入力フォーム */}
      {isParsed && (
        <div style={{ margin: '20px auto', maxWidth: '400px', textAlign: 'left', padding: '15px', border: '2px solid #007BFF', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ fontSize: '18px', color: '#007BFF', marginTop: 0 }}>📋 読み取り結果（修正可能）</h3>
          
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            商品名:
            <input 
              type="text" 
              value={productData.productName} 
              // キーボードで文字を打った時に、状態（State）を書き換える処理
              onChange={(e) => setProductData({...productData, productName: e.target.value})}
              style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            サイズ:
            <input 
              type="text" 
              value={productData.size} 
              onChange={(e) => setProductData({...productData, size: e.target.value})}
              style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>

          <button 
            onClick={() => window.print()}
            style={{ width: '100%', padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer' }}>
            🖨️ この内容でラベルを発行する
          </button>
        </div>
      )}

      {/* アクションボタン */}
      {!capturedImage ? (
        <button onClick={handleCaptured} disabled={isProcessing}
          style={{ padding:'15px 30px', fontSize: '18px', cursor: 'pointer', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', opacity: isProcessing ? 0.5 : 1 }}>
          スキャンする
        </button>
      ) : (
        <button onClick={handleRetake} disabled={isProcessing}
          style={{ padding:'15px 30px', fontSize: '18px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', opacity: isProcessing ? 0.5 : 1, marginTop: '10px' }}>
          {isProcessing ? '解析中' : '撮り直す'}
        </button>
      )}
      
    </div> {/* ← これが元々のメイン画面を閉じるタグ */}

    {/* 印刷用ラベル */}
    <div className="print-only">
      <table className="custom-label-table">
        <tbody>
          <tr>
            <th>商品名：</th>
            <td>{productData.productName}</td>
            <th>サイズ：</th>
            <td>{productData.size}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </>  /* ← ★★★ここが正解！！！この「空の閉じタグ」を追加してください★★★ */
    
  );
}

export default App;