import * as THREE from "three";                           // three.js の全APIを THREE 名前空間で読み込む（import mapで解決）
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // マウスでカメラ操作できるコントローラ
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

// --- 基本セットアップ ---
const scene = new THREE.Scene();                           // 3D空間（オブジェクトやライトを入れる箱）
const clock = new THREE.Clock();

const camera = new THREE.PerspectiveCamera(                // 透視投影カメラ（人の目に近い）
  60,                                                      // 視野角（FOV）60°
  window.innerWidth / window.innerHeight,                  // 画面のアスペクト比
  0.1,                                                     // 手前の描画限界（ニア）
  1000                                                     // 奥の描画限界（ファー）
);
camera.position.set(3, 2, 6);                              // カメラ位置（x=3, y=2, z=6）少し離して俯瞰

const renderer = new THREE.WebGLRenderer({ antialias: true }); // WebGL描画装置（アンチエイリアスON）
renderer.setPixelRatio(window.devicePixelRatio);           // 高DPI画面での見た目最適化
renderer.setSize(window.innerWidth, window.innerHeight);   // キャンバスサイズをウィンドウに合わせる
renderer.shadowMap.enabled = true;                         // 影の計算を有効化（ライト/メッシュ側の設定も必要）
renderer.outputColorSpace = THREE.SRGBColorSpace;          // r152+ 推奨
renderer.toneMapping = THREE.ACESFilmicToneMapping;        // 自然な発色
renderer.toneMappingExposure = 1.4;                        // ← 1.0 を基準に 1.1〜1.6 で微調整
document.body.appendChild(renderer.domElement);            // 生成された <canvas> をDOMに追加して表示

// === ラベル用レンダラーを追加 ===
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none"; // マウス操作は透過
document.body.appendChild(labelRenderer.domElement);

// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement); // カメラをマウスで回転/ズーム/パン
controls.enableDamping = true;                           // 慣性（減衰）を有効化（滑らかな動き）
controls.dampingFactor = 0.05;                           // 慣性の強さ
controls.target.set(0, 0.5, 0);                          // カメラが注視する中心点（原点より少し上）

// cube 生成前に
const tex = new THREE.TextureLoader().load("./public/test.jpg"); // テクスチャ画像を読み込み（非同期ロード開始）
tex.colorSpace = THREE.SRGBColorSpace;                   // sRGBとして解釈（色のガンマ補正が正しくなる）

// --- 立方体 ---
const cube = new THREE.Mesh(                              // メッシュ＝形状 + 材質 の組み合わせ
  new THREE.BoxGeometry(1, 1, 1),                         // 1x1x1 の箱
  // new THREE.MeshStandardMaterial({ color: 0x3aa3ff, roughness: 0.4, metalness: 0.2 })
  new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 }) // 物理ベース材質+テクスチャ
);
cube.position.y = 0.85;                                   // 床から少し浮かせる（重なりやチラつき回避）
// const baseY = cube.position.y;                            // cube 生成のすぐ下あたりに初期Yを保存
cube.castShadow = true;                                   // このメッシュが影を「落とす」ことを許可
scene.add(cube);                                          // シーンに追加

// === 立方体の“上に”文字ラベルを追加 ===
const div = document.createElement("div");
div.textContent = "Genshin Impact";
div.className = "cube-label";                             // CSSクラスを指定するだけ

// 3Dオブジェクト化して cube に子要素として追加
const label = new CSS2DObject(div);
// label.position.set(0, 1.2, 0);                            // 立方体の上に配置（y方向に+1.2）
// cube.add(label);

scene.add(label);                                         // cubeの子ではなく scene に直接追加
const labelBase = new THREE.Vector3(0, 1.2, 0);           // ラベルの基準位置（cubeの頭上）


// === クリック判定用 Raycaster と一時ベクトル ===
let vy = 0;                                               // 現在のY速度
const g = -9.8 * 0.6;                                     // 重力（好みで調整）
const jumpV = 4.2;                                        // 初速（好みで調整）
const landY = 0.5 + 0.35;                                 // 着地ライン: キューブ半径0.5 + 少し浮かせる
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();                          // マウス座標を正規化デバイス座標へ

// canvas 上の座標を NDC(-1〜1) に変換
function setPointerNDC(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

// クリック時：レイキャストして cube に当たっていたらジャンプ
function onCanvasPointerDown(ev) {
  setPointerNDC(ev);
  // レイの発射方向を更新（行列が最新になるように）
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObject(cube, false);     // 直接オブジェクトだけ
  if (hits.length > 0) {
    // vy = jumpV;                                            // 何度もジャンプ
    if (cube.position.y <= landY + 1e-6) vy = jumpV;       // 地上でのみジャンプ
  }
}

// ホバー時にカーソルを pointer に（任意）
function onCanvasPointerMove(ev) {
  setPointerNDC(ev);
  raycaster.setFromCamera(ndc, camera);
  const hovering = raycaster.intersectObject(cube, false).length > 0;
  renderer.domElement.style.cursor = hovering ? "pointer" : "";
}

// イベントは canvas に紐づけるのが確実
renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);

// --- 床 ---
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),                        // 10x10 の平面
  new THREE.MeshStandardMaterial({ color: 0x222227, roughness: 0.9 }) // ざらっとした床
);
floor.rotation.x = -Math.PI / 2;                          // 平面を水平に寝かせる（X軸90°回転）
floor.receiveShadow = true;                               // 影を「受ける」ことを許可
scene.add(floor);                                         // シーンに追加

// ライト（環境光＋平行光）
const ambient = new THREE.AmbientLight(0xffffff, 0.4);    // 環境光：全体を均一にうっすら明るく
ambient.intensity = 0.6;                                  // 0.4 → 0.6 程度
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);    // 平行光：太陽のような光（影ができる）
dir.position.set(3, 5, 2);                                // 光源位置（影の方向に影響）
dir.castShadow = true;                                    // このライトで影を生成
dir.shadow.mapSize.set(1024, 1024);                       // 影テクスチャの解像度（高すぎると重い）
dir.intensity = 1.3;                                      // 1.0 → 1.2〜1.6 程度
scene.add(dir);

// 追加：空＋地面の反射光（柔らかく明るくなる）
const hemi = new THREE.HemisphereLight(0xffffff, 0x202025, 0.4); // (sky, ground, intensity)
scene.add(hemi);

// --- ループ ---
function animate() {
  requestAnimationFrame(animate);                         // 次フレームで animate を再実行（60fps目安）

  const dt = clock.getDelta();                            // このフレームの経過秒（毎フレーム1回だけ）
  const t  = clock.elapsedTime;                           // これまでの累積秒（getDelta呼び出し後に更新済み）

  // const t = clock.getElapsedTime();                       // 経過秒

  cube.rotation.x += 0.005;                               // 立方体を少しずつ回転（X軸）
  cube.rotation.y += 0.005;                               // 立方体を少しずつ回転（Y軸）

  // 上下移動＋わずかな傾き
  // cube.position.y = baseY + Math.sin(t * 2.0) * 5;        // 0.5秒周期くらいでふわっと上下（振幅5）
  // cube.rotation.z = Math.sin(t * 1.5) * 0.05;             // ほんの少し傾けて“呼吸感”

  // ふわっと大きさが変わる
  // const s = 1.0 + Math.sin(t * 2.2) * 0.5;                // ±50%
  // cube.scale.set(s, s, s);

  // === ラベルを水平周回させる ===
  const r = 0.8;                                             // 半径
  const speed = 1.2;                                         // 速度（大きいほど速い）
  label.position.set(
    cube.position.x + Math.cos(t * speed) * r,
    cube.position.y + labelBase.y,                           // cubeの上から少し浮かせた高さ
    cube.position.z + Math.sin(t * speed) * r
  );

  // クリックで“ポンッ”とジャンプ（簡易物理）
  vy += g * dt;
  cube.position.y += vy * dt;
  // 着地処理
  if (cube.position.y <= landY) {
    cube.position.y = landY;
    // vy = 0;                                               // 跳ね返りなし
    vy = -vy * 0.4;                                       // 跳ね返りあり（0.0〜0.8くらいで調整）
  }
  
  controls.update();                                      // enableDamping 有効時は毎フレーム更新が必要
  renderer.render(scene, camera);                         // シーンをカメラ視点で描画
  labelRenderer.render(scene, camera);
}
animate();                                                // ループ開始

// --- リサイズ対応 ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; // 画面比率を更新
  camera.updateProjectionMatrix();                        // 変更の反映（必須）
  renderer.setSize(window.innerWidth, window.innerHeight);// キャンバスもリサイズ
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
