//インポート
import { useState ,useRef, useCallback } from "react";
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';
import { TEST_IMAGE_BASE64 } from './testImageData';

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
      resolve(canvas.toDataURL('image/jpeg', 1.0));
    };
  });
};

function App() {
  const appTitle = "タグ読みくん";
  const webcamRef = useRef(null);

  // --- 状態（State）の管理 ---
  const [currentText, setCurrentText] = useState("枠内にタグを合わせてください...");
  const [capturedImage, setCapturedImage] = useState();   //capturedImageはただのキャプチャー
  const [photo, setphoto] = useState([]);   //写真保存庫
  const [isProcessing, setIsProcessing] = useState(false);
  const [count, setCount] = useState(0);
  const [isJobScreenOpen, setIsJobScreenOpen] = useState(false);

  const testImagePart = {
    inlineData: { data: TEST_IMAGE_BASE64, mimeType: "image/jpeg" }
  };

  
  //AIから受け取ったデータを管理する構造体
  const [productDataList, setProductDataList] = useState([]);

  //解析が成功したかどうかを判定するフラグ
  const [isParsed, setIsParsed] = useState(false);

  // --- 撮影処理 ---
  const handleCaptured = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    const image = await cropImageFromBase64(imageSrc);  
    setCapturedImage(image);
    setphoto((prevPhoto) => [...prevPhoto, image]); //...prevphotoのお陰でprevphotoはphoto配列の全てを指している
    setCount((prevCount) => prevCount + 1);
  }, [webcamRef]);

  const handleContinue = () =>{
    setCapturedImage(null);
  }

  const handleRetake = () => {
    setCapturedImage(null);
    setIsParsed(false); // フォームを隠す
    setCurrentText("枠内にタグを合わせてください...");
    setCount((prevCount) => prevCount - 1);
    setphoto((prevPhoto) => prevPhoto.slice(0,-1));  // 写真の配列から、最新の1枚を取り除く
  }

  const handleNewtake = () => {
    //初期化
    setCapturedImage(null);
    setIsParsed(false); // フォームを隠す
    setProductDataList([]); // データを空に戻す
    setCurrentText("枠内にタグを合わせてください...");
    setCount(0);
    setphoto([]);
  }


  //AIに投げる部分
  const handleAnalyze = useCallback(async () => {
    analyzeWithGemini(photo);  //関数
  }, [webcamRef,photo]);


  // --- AI解析処理 ---
  const analyzeWithGemini = async (photoArray) => {
    // 処理中フラグをON
    setIsProcessing(true);
    setCurrentText("読み取り中♪♪");
    // 印刷フォームを一旦隠す（下の方に書いてある印刷フォームのオンオフに関わる）
    setIsParsed(false); 

    // photoArray の中身は ["写真1の文字列", "写真2の文字列", "写真3の文字列"]
    //() の中にある変数base64Strは、配列の要素1個を指すための一時的な名前。（引数的なもの）
    try {
      const imageParts = photoArray.map((base64Str) => {
        // 1. カンマで割って純粋なデータにする
        const pureBase64 = base64Str.split(",")[1];
        // 2. Gemini専用の箱に入れて返す
        return {
          inlineData: { data: pureBase64, mimeType: "image/jpeg" }
        };
      });

      // 3. AIモデルの呼び出し設定。「3.1-flash-lite」を使い、返事は必ず「JSON形式」にするよう強制（generationConfig）します。
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite",
        generationConfig: { responseMimeType: "application/json" }
      });

      // 4. プロンプト（指示文）。ここでJSONのキー名（productName等）を指定しておくことが超重要です。
      const promptStart = `
        あなたはアパレル店舗の在庫管理を支える専門AIです。
        提供された画像から、ラベル印刷に必要な情報を正確に抽出してください。
        複数の画像が入力された場合、送信された画像の順番通りに、それぞれの画像から商品名とサイズを抽出し、必ず以下のような「JSONの配列（リスト形式）」で出力してください。
        【抽出のルール】
        1. 商品名(productName): 「チョーカーツキドロストT」や「チュールビスチェ」のような商品名称を探してください。
        2. サイズ(size): 「SIZE」という項目の横にある「F」や「M」「L」などを探してください。複数のサイズが記載されている場合、それら全てを読み取ってください。

        出力は必ず以下のJSONフォーマットのみで行ってください。
        解説や挨拶は一切不要です。
        出力フォーマット例（画像が3枚だった場合）
          [
            {"productName": "チョーカーツキドロストT", "size": "F"},
            {"productName": "チュールビスチェ", "size": "S M L LL"},
            {"productName": "不明", "size": "不明"}
          ]

        【例題】
        例えば、以下のような画像が入力された場合、出力の正解はこうなります。
      `;

      const promptExpectedOutput = `
        [
          {"productName": "ラメソデSRGSSTOPS", "size": "LL F"}
        ]

        【本番】
        ルールは理解できましたね。
        それでは、上記を踏まえて以下の画像を解析し、JSONの配列のみを出力してください。
      `;

      // 5. AIに画像と指示を送り、返事が来るまで待機（await）します。
      //const result = await model.generateContent([prompt, ...imageParts]);  //generateContent([prompt, imagePart])が投げている部分
      const result = await model.generateContent([
        promptStart,
        testImagePart,        
        promptExpectedOutput,
        ...imageParts         
      ]);
      const response = await result.response;
      let text = response.text(); // AIの返事を文字列として取り出す
      
      // 6. 正規表現（/ /g）という手法を使って、AIが勝手につけた ```json などの余計な文字を空文字("")に置き換えて（replace）、前後の空白を削除（trim）します。
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

      // 7. 文字列（ただの文字の羅列）を、JavaScriptが操作できる「JSONオブジェクト（データの塊）」に変換（パース）します。
      const data = JSON.parse(text); 
      // 8. 変換したデータをStateに保存します。これで画面のフォームに文字が入ります。
      setProductDataList(data); //構造体にデータが入る

      setIsParsed(true); 
      setCurrentText("必要に応じて修正してください。");

    } catch(error){
      console.error("Gemini詳細エラー:", error);
      setCurrentText(`エラー: ${error.message}`);
    } finally {
      setIsProcessing(false); 
    }
  };


  // 特定のカード（インデックス）の、特定の項目（フィールド）を書き換える関数
  const handleChangeData = (index, field, value) => {
    setProductDataList((prevData) => {
      // 1. 現在の配列（prevData）をそっくりそのままコピーして新しい配列を作る
      const newData = [...prevData];

      // 2. コピーした配列の「index番目」のオブジェクトを見つけ、
      //    その中の「field（productName または size）」を「新しい文字（value）」に書き換える
      newData[index] = {
        ...newData[index],       // 元々入っていた他の項目（書き換えない方）をキープ
        [field]: value           // 指定された項目だけを上書き
      };

      // 3. 完璧に仕上がった新しい配列をReactに返して、画面を更新してもらう
      return newData;
    });
  };

  const handleDeletePhoto = (targetIndex) => {
    // 1. 写真の配列を更新する
    setphoto((prevPhoto) => {
      // prevPhoto の中から、「現在の出席番号(index)」が「消したい番号(targetIndex)」と
      // 『一致しない（!==）』ものだけを合格として残す！
      return prevPhoto.filter((_, index) => index !== targetIndex);
    });
    // 2. 全体の撮影枚数（count）も1つ減らす
    setCount((prevCount) => prevCount - 1);
  };


  return (
    // 📱 アプリ全体の大枠（スマホサイズに固定し、背景を黒にする）
    <div className="no-print" style={{ 
      width: '100%', maxWidth: '400px', height: '100vh', margin: '0 auto', 
      backgroundColor: '#121212', color: '#ffffff', 
      position: 'relative', overflow: 'hidden', fontFamily: 'sans-serif'
    }}>

      {/* ================================================= */}
      {/* 📸 1. 撮影前の画面（Figmaデザインの再現）             */}
      {/* ================================================= */}
      {!capturedImage && (
        <>
          {/* ▼ 第1層：一番奥にカメラを全画面で配置 ▼ */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} // coverで全画面に引き伸ばす
            />

            {/* ▼ 第2層：カメラの上に被せる「半透明の黒い暗闇」と「透明な穴（スキャン枠）」 ▼ */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
              width: '240px', height: '240px',
              boxShadow: '0 0 0 9999px rgba(18, 18, 18, 0.85)', // 枠の外側をすべて暗くする魔法
              borderRadius: '20px',
            }}>
              {/* 白いカギカッコの装飾 */}
              <div style={{ position: 'absolute', top: '-15px', left: '-15px', width: '40px', height: '40px', borderTop: '4px solid #fff', borderLeft: '4px solid #fff', borderTopLeftRadius: '20px' }}></div>
              <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '40px', height: '40px', borderTop: '4px solid #fff', borderRight: '4px solid #fff', borderTopRightRadius: '20px' }}></div>
              <div style={{ position: 'absolute', bottom: '-15px', left: '-15px', width: '40px', height: '40px', borderBottom: '4px solid #fff', borderLeft: '4px solid #fff', borderBottomLeftRadius: '20px' }}></div>
              <div style={{ position: 'absolute', bottom: '-15px', right: '-15px', width: '40px', height: '40px', borderBottom: '4px solid #fff', borderRight: '4px solid #fff', borderBottomRightRadius: '20px' }}></div>
            </div>
          </div>

          {/* ▼ 第3層：手前に浮かぶテキストとボタン群 ▼ */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
            
            {/* ヘッダー */}
            <h1 style={{ textAlign: 'center', marginTop: '50px', fontSize: '22px', letterSpacing: '2px' }}>
              タグ読みくん
            </h1>

            {/* ガイドテキスト */}
            <p style={{ position: 'absolute', bottom: '180px', width: '100%', textAlign: 'center', fontSize: '14px' }}>
              枠内にスキャンしたいタグを収めてください。
            </p>

            {/* ボトムの操作エリア（3つのボタン） */}
            <div style={{ position: 'absolute', bottom: '40px', width: '100%', display: 'flex', justifyContent: 'space-evenly', alignItems: 'flex-end' }}>
              
              {/* アルバムボタン */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>🖼️</div>
                <span style={{ fontSize: '12px', marginTop: '8px' }}>Album</span>
              </div>

              {/* 中央の巨大シャッターボタン（ここを押すと handleCaptured が動く） */}
              <button 
                onClick={handleCaptured} 
                disabled={isProcessing}
                style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'transparent', border: '4px solid #fff', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 0 }}
              >
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff' }}></div>
              </button>

              {/* ライトボタン */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>🔦</div>
                <span style={{ fontSize: '12px', marginTop: '8px' }}>Light</span>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ================================================= */}
      {/* 📋 2. 撮影後（リザルト）の画面（今回は仮置き）       */}
      {/* ================================================= */}
      {capturedImage && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20, backgroundColor: '#121212' }}>
          <img src={capturedImage} alt="撮影結果" style={{ width: '100%', height: '60%', objectFit: 'cover' }} />
          
          <div style={{ padding: '20px' }}>
            <p>ここに下からポップアップするUIを作ります！</p>
            <button onClick={handleRetake} style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px' }}>
              やり直す
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
export default App;