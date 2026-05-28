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
  const [rawResponse, setRawResponse] = useState("");
  const [count, setCount] = useState(0);
  
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
      //product codeを抜いた
      const prompt = `
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
      `;

      // 5. AIに画像と指示を送り、返事が来るまで待機（await）します。
      const result = await model.generateContent([prompt, ...imageParts]);  //generateContent([prompt, imagePart])が投げている部分
      const response = await result.response;
      let text = response.text(); // AIの返事を文字列として取り出す
      setRawResponse(text);
      
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
    setProductData((prevData) => {
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
              style={{ width:'100%',  display: 'block' }}
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
        //全体の大枠
        <div style={{ margin: '20px auto', maxWidth: '400px', textAlign: 'left', padding: '15px', border: '2px solid #007BFF', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ fontSize: '18px', color: '#007BFF', marginTop: 0 }}>📋 読み取り結果　{productDataList.length}件</h3>
          {productData.map((item, index) => (
            
            // 1件分の「カード」のデザイン
            // Reactのルールで、一番外側のタグには必ず key={index} をつける！
            <div key={index} style={{ border: '2px solid #ccc', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>

              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                商品名:
                {/* value には、この1件分（item）のデータを表示する */}
                <input 
                  type="text" 
                  value={item.productName} 
                  onChange={(e) => handleChangeData(index, 'productName', e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                サイズ:
                <input 
                  type="text" 
                  value={item.size} 
                  onChange={(e) => handleChangeData(index, 'size', e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </label>

            </div>
          ))}
          
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            商品名:
            <input 
              type="text" 
              value={productDataList.productName} 
              // キーボードで文字を打った時に、状態（State）を書き換える処理
              onChange={(e) => setProductDataList({...productDataList, productName: e.target.value})}
              style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            サイズ:
            <input 
              type="text" 
              value={productDataList.size} 
              onChange={(e) => setProductDataList({...productDataList, size: e.target.value})}
              style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>

          <button 
            onClick={() => window.print()}
            style={{ width: '100%', padding: '15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer' }}>
            🖨️ ラベルを発行する
          </button>
        </div>
      )}

      {/* アクションボタン */}
      {!capturedImage ? (
        <button onClick={handleCaptured} disabled={isProcessing}
          style={{ padding:'15px 30px', fontSize: '18px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', opacity: isProcessing ? 0.5 : 1 }}>
          スキャンする
        </button>
      ) : (
        <button onClick={handleRetake} disabled={isProcessing}
          style={{ padding:'15px 30px', fontSize: '18px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', opacity: isProcessing ? 0.5 : 1, marginTop: '10px' }}>
          {isProcessing ? '解析中' : '取り直す'}
        </button>
      )}

      {capturedImage && (
        <button onClick={handleContinue} disabled={isProcessing}
          style={{ padding:'15px 30px', margin:'30px',  fontSize: '18px', backgroundColor: '#3546dc', color: 'white', border: 'none', borderRadius: '15px'}}>
            続けて撮影
        </button>
      )}
      
      {capturedImage && (
        <button onClick={handleAnalyze} disabled={isProcessing}
          style={{ padding:'15px 30px',  fontSize: '18px', backgroundColor: '#146931', color: 'white', border: 'none', borderRadius: '15px'}}>
            解析
        </button>
      )}
    </div> {/* ← これが元々のメイン画面を閉じるタグ */}

    <div>
      {rawResponse && (
        <div style={{
          marginTop: '40px',
          padding: '15px',
          backgroundColor: '#1e1e1e', 
          color: '#00ff00',           
          borderRadius: '8px',
          textAlign: 'left',
          fontSize: '14px',
          border: '1px solid #333'
        }}>
          <h4 style={{ color: '#fff', marginTop: 0 }}>【デバッグ】AIの生レスポンス</h4>
          {/* <pre> タグを使うと、AIが返してきた改行やスペースがそのまま綺麗に表示されます */}
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0 }}>
            {rawResponse}
          </pre>
        </div>
      )}
    </div>

    {/* 印刷用ラベル */}
    <div className="print-only">
      <table className="custom-label-table">
        <tbody>
          <tr>
            <th>商品名：</th>
            <td>{productDataList.productName}</td>
            <th>サイズ：</th>
            <td>{productDataList.size}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </>  /* ← ★★★ここが正解！！！この「空の閉じタグ」を追加してください★★★ */
    
  );
}

export default App;