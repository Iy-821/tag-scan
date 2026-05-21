# Node.jsの軽量版イメージを使用
FROM node:20-alpine

# コンテナ内の作業場所を /app に設定
WORKDIR /app

# まずはパッケージの設計図（package.json）だけをコピー
COPY package*.json ./

# 必要なパッケージをインストール
RUN npm install

# 残りのすべてのファイルをコンテナにコピー
COPY . .

# Viteのデフォルトポートである5173番を開放
EXPOSE 5173

# 開発サーバーを起動するコマンド（--hostをつけることで外部からアクセス可能にする）
CMD ["npm", "run", "dev", "--", "--host"]