//インポート
import { useState ,useRef, useCallback } from "react";
import Webcam from 'react-webcam';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './App.css';
import { TEST_IMAGE_BASE64 } from './testImageData';
import Button from './assets/Button.png';
import Frame from './assets/Frame.png';


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

//URL:http://localhost:5173

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
  const appTitle = "タグ読みくん";
  const webcamRef = useRef(null);
  const [currentText, setCurrentText] = useState("枠内にタグを合わせてください...");
  const [capturedImage, setCapturedImage] = useState();   //capturedImageはただのキャプチャー
  const [photo, setphoto] = useState([]);   //写真保存庫
  const [isProcessing, setIsProcessing] = useState(false);
  const [count, setCount] = useState(0);
  const [isJobScreenOpen, setIsJobScreenOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [captureState, setCaptureState] = useState(false);
  const fileInputRef = useRef(null);
  const testImagePart = {
    inlineData: { data: TEST_IMAGE_BASE64, mimeType: "image/jpeg" }
  };
  const [productDataList, setProductDataList] = useState([]);
  const [isParsed, setIsParsed] = useState(false);

  // --- 撮影処理 ---
  const handleCaptured = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    const image = await cropImageFromBase64(imageSrc);  
    setCapturedImage(image);
    setphoto((prevPhoto) => [...prevPhoto, image]); //...prevphotoのお陰でprevphotoはphoto配列の全てを指している
    setCount((prevCount) => prevCount + 1);
    setCaptureState(false);
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
    setDone(false);
    setIsParsed(false); // フォームを隠す
    setProductDataList([]); // データを空に戻す
    setCurrentText("枠内にタグを合わせてください...");
    setCount(0);
    setphoto([]);
  }

  //AIに投げる部分
  const handleAnalyze = useCallback(async () => {
    analyzeWithGemini(photo);  //関数
    setDone(true);
  }, [webcamRef,photo]);

  const handleDelayCapture = () =>{
    if (captureState == false) {
      setCaptureState(true);
      setTimeout(handleCaptured,200);
    }
  }


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
        const pureBase64 = base64Str.split(",")[1];
        return {
          inlineData: { data: pureBase64, mimeType: "image/jpeg" }
        };
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
      //const result = await model.generateContent([prompt, ...imageParts]);  //generateContent([prompt, imagePart])が投げている部分
      const result = await model.generateContent([
        promptStart,
        testImagePart,        
        promptExpectedOutput,
        ...imageParts         
      ]);
      const response = await result.response;
      let text = response.text(); // AIの返事を文字列として取り出す
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const data = JSON.parse(text); 
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


  // 特定のカードの、特定の項目を書き換える関数
  const handleChangeData = (index, field, value) => {
    setProductDataList((prevData) => {
      // ここで prevData = 今の productDataList の中身が確実に入っている
      const newData = [...prevData];   // それをコピーして
      newData[index] = { ...newData[index], [field]: value }; // 1か所だけ変える
      return newData; // 返したものが新しい state になる
    });
  };

  const handleQuantityChange = (index, value) => {
    //valueを、計算できる数字に変換
    const numValue = parseInt(value, 10) || 1;

    setProductDataList((prevList) =>
      // .map() を使って、リストの服を1つずつチェックしていく
      prevList.map((item, i) =>
        // もし「変更された番号（index）」と「今チェックしてる服の番号（i）」が一致したら　つまり、for文
        i === index 
          ? { ...item, quantity: numValue } // その服だけ quantity を新しい数字に書き換える！
          : item // 関係ない他の服は、そのままスルーする
      )
    );
  }

  const handleDeletePhoto = (targetIndex) => {
    setphoto((prevPhoto) => {
      return prevPhoto.filter((_, index) => index !== targetIndex);
    });
    setCount((prevCount) => prevCount - 1);
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
              screenshotFormat="image/jpeg"
              forceScreenshotSourceSize={true}
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
          <img src={capturedImage} alt="切り取られた写真" style={{ width: '100%',display: 'block', backgroundColor: '#000' }} />
        )}
      </div>

      <div style={{ margin: '20px', padding: '10px', border: '1px solid black' }}>
        <p>Tips:A4用紙1枚につき、最大9個まで可能</p>
        <p>{currentText}</p>
      </div>

      {isParsed && (
        //全体の大枠
        <div style={{ margin: '20px auto', maxWidth: '400px', textAlign: 'left', padding: '15px', border: '2px solid #007BFF', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ fontSize: '18px', color: '#0e77ee', marginTop: 0 }}>📋 読み取り結果 {productDataList.length}件</h3>
          {productDataList.map((item, index) => (
            
            // 1件分の「カード」のデザイン
            <div key={index} style={{ border: '2px solid #ccc', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>

              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                商品名:
                <input 
                  type="text" 
                  value={item.productName} 
                  onChange={(e) => handleChangeData(index, 'productName', e.target.value)}
                  style={{ width: '90%', padding: '10px' }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                サイズ:
                <input 
                  type="text" 
                  value={item.size} 
                  onChange={(e) => handleChangeData(index, e.target.value)}
                  style={{ width: '90%', padding: '10px' }}
                />
              </label>

              <lavel style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                枚数：<br/>
                <input 
                  type="number" 
                  min ="1" 
                  value={item.quantity || 1}
                  onChange={(e) => handleQuantityChange(index, e.target.value)} //eはeventの略
                />
              </lavel>

              <img src={photo[index]} style={{ width: '100%',display: 'block', backgroundColor: '#000' }} />

            </div>
          ))}

          <button 
            onClick={() => window.print()}
            style={{ width: '100%', padding: '15px', backgroundColor: '#6bc232', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer' }}>
            🖨️ ラベルを発行する
          </button>
        </div>
      )}
      <div>
      {!capturedImage && (
        <button onClick={handleDelayCapture} disabled={isProcessing} 
          style={{backgroundColor: 'transparent', padding:'15px 30px', fontSize: '18px',  border: 'none', borderRadius: '5px', opacity: isProcessing ? 0.5 : 1 }}>
          <img src={Button}></img>
        </button>
      )}


      {capturedImage && (
        <div>
          {!done && (
            <div>
              <div>
                <button onClick={handleContinue} disabled={isProcessing}
                style={{ padding:'15px 30px', margin:'15px',  fontSize: '18px', backgroundColor: '#239182', color: 'white', border: 'none', borderRadius: '15px' , opacity: isProcessing ? 0 : 1}}>
                続けて撮影
              </button>

              <button onClick={handleAnalyze} disabled={isProcessing}
                style={{ padding:'15px 30px', margin:'15px',  fontSize: '18px', backgroundColor: '#1b6ad1', color: 'white', border: 'none', borderRadius: '15px' , opacity: isProcessing ? 0 : 1}}>
                解析
              </button>
              </div>
              <div>
                <button onClick={handleRetake} disabled={isProcessing} 
                style={{ padding:'15px 30px', margin:'15px', fontSize: '18px', backgroundColor: '#ad3213', color: 'white', border: 'none', borderRadius: '5px', opacity: isProcessing ? 0 : 1}}>
                取り直す
              </button>

              <button onClick={() => {setIsJobScreenOpen(true)}} disabled={isProcessing}
                style={{ padding:'15px 30px', margin:'15px',  fontSize: '18px', backgroundColor: '#a18712', color: 'white', border: 'none', borderRadius: '15px' , opacity: isProcessing ? 0 : 1}}>
                ジョブ表示
              </button>
              </div>
            </div>
          )}

        {done && (
          <div>
          <button onClick={handleNewtake} disabled={isProcessing}
            style={{ padding:'15px 30px', margin:'15px',  fontSize: '18px', backgroundColor: '#1a3f70', color: 'white', border: 'none', borderRadius: '15px' , opacity: isProcessing ? 0 : 1}}>
            もう一度スキャンする
          </button>
          </div>
        )}
        </div>
      )}
      </div>

      <div>
        {isJobScreenOpen && (
          <div style={{
            position: 'fixed',    // 画面全体にピタッと固定
            top: 0, left: 0,      // 一番左上を基準にする
            width: '100vw',       // 横幅を画面の100%に
            height: '100vh',      // 縦幅を画面の100%に
            backgroundColor: 'rgba(0, 0, 0, 0.7)', // 背景を「80%の濃さの黒（半透明）」にする
            zIndex: 9999,         // 数字をデカくして、何よりも一番手前に持ってくる
            display: 'flex',      // 中身のレイアウト用
            justifyContent: 'center', // 左右のど真ん中に配置
            alignItems: 'center'      // 上下のど真ん中に配置
          }}>
            
            <div style={{
              backgroundColor: '#fff', 
              width: '80%',         // スマホ画面の90%の幅
              height: '90%',        // スマホ画面の80%の高さ
              borderRadius: '12px', // 角を丸くする
              padding: '20px', 
              overflowY: 'auto'     // 写真が多くなったら縦にスクロールできるようにする
            }}>
              
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ marginTop: 0 }}>撮影済みリスト（{count}枚）</h3>
              <button onClick={() => setIsJobScreenOpen(false)}>✖️ 閉じる</button>
            </div>

              {photo.map((src,index) =>(
                <div key={index} style={{ position: 'relative', display: 'inline-block', margin: '10px' }}>
                  <img src={src} alt={`写真${index}`} style={{ width: '100%' }}></img>
                  <button 
                    onClick={() => handleDeletePhoto(index)}
                    style={{
                      position: 'absolute',
                      top: '-10px',      // ★写真の上端から上に10pxはみ出させる
                      left: '-10px',    // ★写真の右端から右に10pxはみ出させる
                      width: '30px',     // ボタンの丸の大きさ
                      height: '30px',
                      borderRadius: '50%', // まん丸にする
                      backgroundColor: '#dc3545', // 警告の赤色
                      color: 'white',
                      border: '2px solid white', // 白いフチをつけるとオシャレ
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)', // 影をつけて浮かせ見せる
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

           </div>
        </div>
        )}
      </div>

    </div> 

    {/*後で確認する */}
    <div className="print-only"> 
      {productDataList.map((item, itemIndex) => (
        
        // 💡 ここが魔法の部分！商品の quantity（枚数）の分だけ、さらにループを回す
        Array.from({ length: item.quantity || 1 }).map((_, copyIndex) => (
          
          // keyが被らないように、商品番号とコピー番号を組み合わせる
          <div key={`${itemIndex}-${copyIndex}`} className="label-container">
            <table className="custom-label-table">
              <tbody>
                <tr>
                  {/* 連番（No.）を綺麗に並べる場合は、全体の通し番号を計算するか、そのまま表示 */}
                  <th>No.{itemIndex + 1} ({copyIndex + 1}枚目)</th>
                  <th>商品名：</th>
                  <td>{item.productName}</td>
                  <th>サイズ：</th>
                  <td>{item.size}</td>
                </tr>
              </tbody>
            </table>
          </div>

        ))

      ))}
    </div>
  </> 
  );
}
export default App;