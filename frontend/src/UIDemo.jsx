import React, { useState } from 'react';

// ※このコードはUI（見た目）のデモ用です。実際のカメラ機能はモック（ダミー）です。
export default function TagReaderUI() {
  const [isScanned, setIsScanned] = useState(false);
  const [count, setCount] = useState(3); // 仮の撮影枚数

  return (
    // スマホ画面を模した外枠（PCで見てもスマホサイズになるように制限）
    <div style={styles.appContainer}>
      
      {/* --- 背景（カメラ映像の代わり） --- */}
      <div style={styles.cameraBackground}>
        {/* スキャン枠（ターゲット） */}
        <div style={styles.scanTarget}>
          <div style={{...styles.corner, ...styles.topLeft}}></div>
          <div style={{...styles.corner, ...styles.topRight}}></div>
          <div style={{...styles.corner, ...styles.bottomLeft}}></div>
          <div style={{...styles.corner, ...styles.bottomRight}}></div>
          {!isScanned && <div style={styles.scanLine}></div>}
        </div>
      </div>

      {/* --- ヘッダー --- */}
      <div style={styles.header}>
        <span style={styles.logo}>TagReader.</span>
      </div>

      {/* --- ボトムコントロールエリア（親指の特等席） --- */}
      <div style={styles.bottomControls}>
        
        {/* 撮影前：通常時のUI */}
        {!isScanned ? (
          <div style={styles.actionRow}>
            {/* 左：アルバムボタン */}
            <button style={styles.iconButton}>
              🖼️
            </button>

            {/* 中央：巨大なスキャン（シャッター）ボタン */}
            <button 
              onClick={() => setIsScanned(true)} 
              style={styles.shutterButton}
            >
              <div style={styles.shutterInner}></div>
            </button>

            {/* 右：ジョブ（履歴）ボタン */}
            <button style={styles.iconButton}>
              📋
              {count > 0 && <span style={styles.badge}>{count}</span>}
            </button>
          </div>
        ) : (
          <div style={styles.bottomSheet}>
          {/* 撮影後：ボトムシート（下からせり上がるカード） */}
            <div style={styles.sheetHandle}></div>
            <h3 style={styles.sheetTitle}>スキャン成功</h3>
            <p style={styles.sheetDesc}>タグの情報を読み取りました。次は何をしますか？</p>
            
            <div style={styles.sheetButtons}>
              {/* メインアクション：AI解析 */}
              <button style={styles.primaryButton}>
                ✨ {count + 1}枚のタグを解析する
              </button>
              
              <div style={styles.secondaryRow}>
                <button 
                  onClick={() => setIsScanned(false)} 
                  style={styles.secondaryButton}
                >
                  🔄 取り直す
                </button>
                <button 
                  onClick={() => setIsScanned(false)} 
                  style={styles.secondaryButton}
                >
                  ➕ 続けて撮る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 以下、デザイン（CSS）の定義 ---
const styles = {
  appContainer: {
    width: '100%',
    maxWidth: '400px', // スマホサイズに固定
    height: '800px',
    margin: '20px auto',
    backgroundColor: '#000', // ダークモード
    borderRadius: '40px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
  },
  cameraBackground: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(circle at center, #2a2d34 0%, #111 100%)', // カメラの暗がりを表現
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: '260px',
    height: '260px',
    position: 'relative',
    transform: 'translateY(-50px)', // 少し上に配置
  },
  corner: {
    position: 'absolute',
    width: '40px',
    height: '40px',
    borderColor: '#CFFF04', // トレンドのネオンイエロー
    borderStyle: 'solid',
  },
  topLeft: { top: 0, left: 0, borderWidth: '4px 0 0 4px' },
  topRight: { top: 0, right: 0, borderWidth: '4px 4px 0 0' },
  bottomLeft: { bottom: 0, left: 0, borderWidth: '0 0 4px 4px' },
  bottomRight: { bottom: 0, right: 0, borderWidth: '0 4px 4px 0' },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: '5%',
    right: '5%',
    height: '2px',
    backgroundColor: '#CFFF04',
    boxShadow: '0 0 10px #CFFF04',
  },
  header: {
    position: 'absolute',
    top: '40px',
    width: '100%',
    textAlign: 'center',
    zIndex: 10,
  },
  logo: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    zIndex: 20,
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '40px 20px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
  },
  shutterButton: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    border: '4px solid #fff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  shutterInner: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#fff',
  },
  iconButton: {
    width: '50px',
    height: '50px',
    borderRadius: '25px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '24px',
    position: 'relative',
    backdropFilter: 'blur(10px)', // ガラス風加工（Glassmorphism）
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    backgroundColor: '#ff3b30',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: '30px',
    borderTopRightRadius: '30px',
    padding: '20px 24px 40px',
    boxShadow: '0 -5px 20px rgba(0,0,0,0.2)',
    animation: 'slideUp 0.3s ease-out forwards',
  },
  sheetHandle: {
    width: '40px',
    height: '5px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    margin: '0 auto 20px',
  },
  sheetTitle: {
    margin: '0 0 10px 0',
    fontSize: '22px',
    color: '#111',
  },
  sheetDesc: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    color: '#666',
  },
  sheetButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    backgroundColor: '#111', // 黒ベースで締める
    color: '#CFFF04', // 文字色にネオンカラー
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
  secondaryRow: {
    display: 'flex',
    gap: '12px',
  },
  secondaryButton: {
    flex: 1,
    padding: '16px',
    borderRadius: '16px',
    backgroundColor: '#f5f5f7',
    color: '#333',
    fontSize: '15px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  }
};