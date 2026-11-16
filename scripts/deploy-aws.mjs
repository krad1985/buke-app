#!/usr/bin/env node
/**
 * 部署到 S3 + CloudFront。
 *
 * 用法（PowerShell）：
 *   $env:S3_BUCKET="buke-app-web"; $env:CF_DIST_ID="E1234567890"; npm run deploy:aws
 * 用法（cmd）：
 *   set S3_BUCKET=buke-app-web && set CF_DIST_ID=E1234567890 && npm run deploy:aws
 *
 * 需要先安裝並設定 AWS CLI（aws configure 或 SSO）。
 */
import { execSync } from 'node:child_process';

const bucket = process.env.S3_BUCKET;
const distId = process.env.CF_DIST_ID;

if (!bucket) {
  console.error('缺少環境變數 S3_BUCKET（例如 buke-app-web）');
  process.exit(1);
}

const run = (cmd) => {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
};

run('npm run build');
run(`aws s3 sync dist/ s3://${bucket} --delete --cache-control "public,max-age=31536000,immutable" --exclude "index.html" --exclude "*.html"`);
run(`aws s3 cp dist/index.html s3://${bucket}/index.html --cache-control "no-cache,no-store,must-revalidate"`);

if (distId) {
  run(`aws cloudfront create-invalidation --distribution-id ${distId} --paths "/*"`);
} else {
  console.warn('沒有設定 CF_DIST_ID，略過 CloudFront 快取清除（index.html 可能還是舊的）');
}
