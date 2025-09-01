"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, ChevronRight, CreditCard, Lock } from "lucide-react";
import Link from "next/link";

interface AuthStep {
  id: number;
  title: string;
  description: string;
  phase?: string;
  readerData: string;
  cardData: string;
  explanation: string;
  details: string; // 整合的技術說明
}

const authSteps: AuthStep[] = [
  {
    id: 1,
    title: "發送驗證命令",
    description: "讀卡機發送 AUTH_A 命令，指定要驗證的區塊號",
    readerData: "AUTH: 60E4C2", // AUTH_A + block 4 + CRC
    cardData: "等待卡片回應...",
    explanation: "讀卡機發送 AUTH_A (0x60) 命令驗證區塊 4，使用金鑰 A 進行存取控制驗證",
    details: "AUTH_A 命令格式：[0x60][Block][CRC-A]。0x60 表示使用金鑰 A 進行驗證，Block 指定要存取的區塊號，CRC-A 提供錯誤檢測。命令經 Modified Miller 編碼傳輸。",
  },
  {
    id: 2,
    title: "卡片發送挑戰數",
    description: "卡片產生 32-bit 隨機數 nT 作為挑戰值",
    readerData: "接收並記錄 nT...",
    cardData: "nT: 4C983BF2", // nT (Tag Nonce)
    explanation: "卡片使用 PRNG 產生隨機挑戰數 nT，以明文形式回應給讀卡機",
    details: "nT (Tag Nonce) 由卡片的 16-bit LFSR 產生，雖然稱為隨機數但實際可預測。此數值將作為後續 Crypto1 加密的初始化種子使用。",
  },
  {
    id: 3,
    title: "Crypto1 初始化",
    description: "雙方使用共享金鑰和 UID 初始化 Crypto1 演算法",
    readerData: "初始化 Crypto1 LFSR...",
    cardData: "同步初始化 Crypto1...",
    explanation: "使用 48-bit 金鑰、UID 和 nT 初始化 Crypto1 的 48-bit LFSR 狀態",
    details: "Crypto1 初始化：Key ⊕ (UID:DEADBEEF ⊕ nT:4C983BF2) → LFSR 初始狀態。48-bit LFSR 使用反饋多項式 x^48 + x^43 + x^39 + x^38 + x^36 + x^34 + x^33 + x^31 + x^17 + x^15 + x^13 + x^12 + x^10 + x^8 + x^5 + x^2 + x + 1",
  },
  {
    id: 4,
    title: "讀卡機產生認證",
    description: "讀卡機產生隨機數 nR 並計算加密認證 aR",
    readerData: "計算 nR 和 aR...",
    cardData: "等待認證挑戰...",
    explanation: "讀卡機產生 nR，並計算 aR = suc2(nT) ⊕ nR",
    details: "nR (Reader Nonce) 為 32-bit 隨機數。aR 計算：先對 nT 進行 suc2() 運算（Crypto1 加密的一種），再與 nR 進行 XOR。這證明讀卡機擁有正確金鑰。",
  },
  {
    id: 5,
    title: "傳送加密挑戰",
    description: "讀卡機發送加密的 nR 和 aR 給卡片",
    readerData: "nR+aR: 8A347D2E B6F81290", // encrypted nR + aR
    cardData: "接收並解密驗證...",
    explanation: "所有後續通訊都經過 Crypto1 加密，卡片需驗證 aR 的正確性",
    details: "數據格式：[nR_encrypted(4bytes)][aR_encrypted(4bytes)]。Crypto1 採用串流加密，每個 bit 都與 keystream 進行 XOR。卡片解密後會重新計算 aR 進行驗證。",
  },
  {
    id: 6,
    title: "卡片驗證讀卡機",
    description: "卡片解密數據並驗證 aR 的正確性",
    readerData: "等待卡片確認...",
    cardData: "解密並驗證 aR...",
    explanation: "卡片重新計算預期的 aR 值，與收到的值比較確認讀卡機身份",
    details: "驗證過程：解密 nR 和 aR → 重新計算 aR' = suc2(nT) ⊕ nR → 比較 aR == aR'。成功則確認讀卡機擁有正確金鑰，否則中止驗證程序。",
  },
  {
    id: 7,
    title: "卡片產生回應",
    description: "卡片計算 aT 作為身份證明",
    readerData: "等待卡片身份證明...",
    cardData: "計算 aT = suc3(nR)...",
    explanation: "卡片計算 aT = suc3(nR) 證明自己也擁有正確的金鑰",
    details: "aT 計算使用 suc3() 函數對 nR 進行運算。suc3() 是 Crypto1 的另一個原語，與 suc2() 類似但使用不同的參數。這實現了相互驗證的第二部分。",
  },
  {
    id: 8,
    title: "發送最終確認",
    description: "卡片發送加密的 aT 完成相互驗證",
    readerData: "接收並驗證 aT...",
    cardData: "aT: F16AC95B", // encrypted aT
    explanation: "讀卡機收到 aT 後進行解密和驗證，確認卡片的合法性",
    details: "aT 經 Crypto1 加密傳輸。讀卡機解密後重新計算 aT' = suc3(nR) 進行比較。驗證成功後，雙方確認彼此身份，建立安全通道。",
  },
  {
    id: 9,
    title: "完成相互驗證",
    description: "驗證成功，建立安全的加密通道",
    readerData: "驗證成功，通道建立",
    cardData: "準備接收後續指令",
    explanation: "雙方完成相互驗證，建立基於 Crypto1 的加密通訊通道",
    details: "驗證完成後，所有後續通訊都會使用 Crypto1 加密。LFSR 狀態會隨著每個 bit 的傳輸而更新，確保 keystream 的動態性。現在可以安全地進行讀寫操作。",
  }
];

const Crypto1Animation = ({ isActive }: { isActive: boolean }) => {
  return (
    <motion.div 
      className="bg-slate-900/50 rounded-lg p-6 border border-slate-700 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Lock size={20} className="text-yellow-400" />
        Crypto1 Keystream 產生
      </h4>
      
      <div className="space-y-4">
        {/* 輸入參數 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-sm text-slate-300 mb-3">初始化參數</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">UID</div>
              <div className="px-2 py-1 bg-purple-600 rounded text-xs font-mono">DEADBEEF</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">nT</div>
              <div className="px-2 py-1 bg-blue-600 rounded text-xs font-mono">4C983BF2</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">Key A</div>
              <div className="px-2 py-1 bg-green-600 rounded text-xs font-mono">FFFFFFFFFFFF</div>
            </div>
          </div>
        </div>

        {/* Keystream 產生過程 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">Keystream 輸出</span>
            <motion.div
              animate={{ rotate: isActive ? 360 : 0 }}
              transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
              className="w-6 h-6 border-2 border-yellow-400 rounded-full border-dashed"
            />
          </div>
          
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-12">Byte {i}:</span>
                <motion.div
                  className="px-2 py-1 bg-yellow-600 rounded text-xs font-mono"
                  animate={{
                    opacity: isActive ? [0.5, 1, 0.5] : 0.7,
                    scale: isActive ? [1, 1.05, 1] : 1
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.2,
                    repeat: isActive ? Infinity : 0,
                  }}
                >
                  {isActive ? 
                    Math.floor(Math.random() * 0xFF).toString(16).padStart(2, '0').toUpperCase() : 
                    '??'
                  }
                </motion.div>
              </div>
            ))}
          </div>
          
          <div className="text-xs text-slate-400 mt-3">
            每個 bit 傳輸後 LFSR 狀態更新，產生新的 keystream
          </div>
        </div>

        {/* 加密說明 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-sm text-slate-300 mb-2">串流加密原理</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="px-2 py-1 bg-blue-600 rounded font-mono">明文</div>
            <span className="text-slate-400">⊕</span>
            <div className="px-2 py-1 bg-yellow-600 rounded font-mono">Keystream</div>
            <span className="text-slate-400">=</span>
            <div className="px-2 py-1 bg-red-600 rounded font-mono">密文</div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            每個 bit 都與對應的 keystream bit 進行 XOR 運算
          </div>
        </div>

        {/* 攻擊弱點指示 */}
        <motion.div 
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-3"
          animate={{
            borderColor: isActive ? ["#dc2626", "#ef4444", "#dc2626"] : "#dc2626"
          }}
          transition={{
            duration: 2,
            repeat: isActive ? Infinity : 0,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="text-red-400 text-sm font-medium">Keystream 可預測性</span>
          </div>
          <div className="text-xs text-slate-400">
            LFSR 線性特性使得 keystream 可被分析和預測
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

const CardInfoStructure = ({ isActive }: { isActive: boolean }) => {
  return (
    <motion.div 
      className="bg-slate-900/50 rounded-lg p-6 border border-slate-700 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
        <CreditCard size={20} className="text-blue-400" />
        卡片資訊結構
      </h4>
      
      <div className="space-y-4">
        {/* UID 資訊 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">卡片唯一識別碼</span>
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
            <motion.div
              animate={{
                scale: isActive ? [1, 1.05, 1] : 1,
                opacity: isActive ? [0.8, 1, 0.8] : 0.8
              }}
              transition={{
                duration: 2,
                repeat: isActive ? Infinity : 0
              }}
              className="px-3 py-1 bg-purple-600 rounded font-mono text-sm"
            >
              DEADBEEF
            </motion.div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="text-slate-400 mb-1">Byte 0</div>
              <div className="px-2 py-1 bg-purple-500/30 rounded font-mono">DE</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 mb-1">Byte 1</div>
              <div className="px-2 py-1 bg-purple-500/30 rounded font-mono">AD</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 mb-1">Byte 2</div>
              <div className="px-2 py-1 bg-purple-500/30 rounded font-mono">BE</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 mb-1">Byte 3</div>
              <div className="px-2 py-1 bg-purple-500/30 rounded font-mono">EF</div>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 mt-2">
            4-byte UID，用於身份識別與認證初始化
          </div>
        </div>

        {/* Key A 結構 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Key A (讀取金鑰)</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <motion.div
              animate={{
                scale: isActive ? [1, 1.05, 1] : 1,
                opacity: isActive ? [0.8, 1, 0.8] : 0.8
              }}
              transition={{
                duration: 2,
                delay: 0.3,
                repeat: isActive ? Infinity : 0
              }}
              className="px-3 py-1 bg-green-600 rounded font-mono text-sm"
            >
              FFFFFFFFFFFF
            </motion.div>
          </div>
          
          <div className="grid grid-cols-6 gap-1 text-xs">
            {['FF', 'FF', 'FF', 'FF', 'FF', 'FF'].map((byte, i) => (
              <div key={i} className="text-center">
                <div className="text-slate-400 mb-1">B{i}</div>
                <div className="px-1 py-1 bg-green-500/30 rounded font-mono">{byte}</div>
              </div>
            ))}
          </div>
          
          <div className="text-xs text-slate-400 mt-2">
            48-bit 讀取權限金鑰（預設金鑰：全 F）
          </div>
        </div>

        {/* Key B 結構 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Key B (寫入金鑰)</span>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            </div>
            <motion.div
              animate={{
                scale: isActive ? [1, 1.05, 1] : 1,
                opacity: isActive ? [0.8, 1, 0.8] : 0.8
              }}
              transition={{
                duration: 2,
                delay: 0.6,
                repeat: isActive ? Infinity : 0
              }}
              className="px-3 py-1 bg-orange-600 rounded font-mono text-sm"
            >
              FFFFFFFFFFFF
            </motion.div>
          </div>
          
          <div className="grid grid-cols-6 gap-1 text-xs">
            {['FF', 'FF', 'FF', 'FF', 'FF', 'FF'].map((byte, i) => (
              <div key={i} className="text-center">
                <div className="text-slate-400 mb-1">B{i}</div>
                <div className="px-1 py-1 bg-orange-500/30 rounded font-mono">{byte}</div>
              </div>
            ))}
          </div>
          
          <div className="text-xs text-slate-400 mt-2">
            48-bit 寫入權限金鑰（通常隱藏不可讀取）
          </div>
        </div>

        {/* 權限說明 */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-sm text-slate-300 mb-3">存取權限模式</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-slate-300">Key A:</span>
              <span className="text-slate-400">讀取數據塊、進行認證</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-slate-300">Key B:</span>
              <span className="text-slate-400">寫入數據塊、修改存取條件</span>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 mt-3 p-2 bg-slate-700/50 rounded">
            每個扇區都有獨立的 Key A/B 配對，提供不同層級的存取控制
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function AuthenticationPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentStep < authSteps.length - 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => prev + 1);
      }, 4000);
    } else if (currentStep >= authSteps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep]);

  const resetAnimation = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <Link href="/" className="text-green-400 hover:text-green-300 transition-colors">
                <ArrowLeft size={24} />
              </Link>
            </motion.div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Mifare Classic 加密驗證
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? "暫停" : "播放"}
            </motion.button>
            <motion.button
              onClick={resetAnimation}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw size={20} />
              重置
            </motion.button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 主要動畫區域 */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 mb-6"
            >
              {/* 當前步驟標題 */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">
                  步驟 {currentStep + 1}: {authSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-6">
                  {authSteps[currentStep]?.description}
                </p>
              </div>

              {/* 統一的驗證動畫區域 */}
              <div className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-8 mb-6">
                <div className="flex items-center justify-between mb-8">
                  {/* 讀卡機 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? [1, 1.1, 1] : 1,
                        boxShadow: authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? 
                          ['0 0 0px rgba(34, 197, 94, 0.5)', '0 0 20px rgba(34, 197, 94, 0.8)', '0 0 0px rgba(34, 197, 94, 0.5)'] : 
                          '0 0 0px rgba(34, 197, 94, 0.5)'
                      }}
                      transition={{ duration: 1, repeat: authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? Infinity : 0 }}
                      className="w-24 h-32 bg-gradient-to-b from-green-500 to-green-700 rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-2xl">📡</span>
                    </motion.div>
                    <p className="text-sm text-slate-400">讀卡機 (Proxmark3)</p>
                  </div>

                  {/* 資料傳輸動畫區域 */}
                  <div className="flex-1 mx-8 relative h-20 flex items-center">
                    {/* 加密通道背景 */}
                    <motion.div
                      animate={{
                        opacity: currentStep >= 4 ? [0.3, 0.7, 0.3] : 0.2,
                      }}
                      transition={{
                        duration: 2,
                        repeat: currentStep >= 4 ? Infinity : 0,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-lg"
                    >
                      <span className="absolute -top-6 left-2 text-yellow-400 text-xs">
                        {currentStep >= 4 ? 'Crypto1 Encrypted Channel' : 'ISO14443A Channel'}
                      </span>
                    </motion.div>
                    
                    {/* 資料封包動畫 */}
                    <AnimatePresence>
                      {(authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) || 
                        authSteps[currentStep]?.cardData?.match(/^(nT|aT):/)) && (
                        <motion.div
                          key={`auth-data-${currentStep}`}
                          initial={{ 
                            x: authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? -120 : 120,
                            opacity: 0 
                          }}
                          animate={{ 
                            x: authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? 120 : -120,
                            opacity: [0, 1, 1, 1, 0] 
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.2, 0.8, 0.9, 1]
                          }}
                          className={`absolute px-3 py-1 rounded text-sm font-mono whitespace-nowrap top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 ${
                            currentStep >= 4 ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                          }`}
                        >
                          {authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? 
                            authSteps[currentStep]?.readerData?.split(': ')[1] : 
                            authSteps[currentStep]?.cardData?.split(': ')[1]}
                          {currentStep >= 4 && (
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="inline-block ml-2"
                            >
                              🔒
                            </motion.span>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* 方向箭頭 */}
                    <div className="absolute inset-0 flex items-center justify-center z-0">
                      <motion.div
                        animate={{
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                        className="text-3xl text-white"
                      >
                        {authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? '→' :
                         authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) ? '←' : '⚙️'}
                      </motion.div>
                    </div>
                  </div>

                  {/* 卡片 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) ? [1, 1.1, 1] : 1,
                        boxShadow: authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) ? 
                          ['0 0 0px rgba(147, 51, 234, 0.5)', '0 0 20px rgba(147, 51, 234, 0.8)', '0 0 0px rgba(147, 51, 234, 0.5)'] : 
                          '0 0 0px rgba(147, 51, 234, 0.5)'
                      }}
                      transition={{ duration: 1, repeat: authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) ? Infinity : 0 }}
                      className="w-20 h-28 bg-gradient-to-b from-purple-500 to-purple-700 rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-2xl">💳</span>
                    </motion.div>
                    <p className="text-sm text-slate-400">卡片 (UID: DEADBEEF)</p>
                  </div>
                </div>

                {/* 流向與資料說明 */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2">
                    <span className="text-slate-400 text-sm">資料流向：</span>
                    <span className="text-yellow-400 font-mono font-bold">
                      {authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) && '📡 讀卡機 → 卡片 💳'}
                      {authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) && '💳 卡片 → 讀卡機 📡'}
                      {!authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) && 
                       !authSteps[currentStep]?.cardData?.match(/^(nT|aT):/) && '⚙️ 內部處理'}
                    </span>
                    {(authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) || 
                      authSteps[currentStep]?.cardData?.match(/^(nT|aT):/)) && (
                      <>
                        <span className="text-slate-400 text-sm">資料：</span>
                        <span className="text-green-400 font-mono font-bold">
                          {authSteps[currentStep]?.readerData?.match(/^(AUTH|nR|aT):/) ? 
                            authSteps[currentStep]?.readerData : 
                            authSteps[currentStep]?.cardData}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 技術說明 */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="text-lg font-bold text-slate-200 mb-3">技術說明</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {authSteps[currentStep]?.details}
                </p>
              </div>
            </motion.div>

            {/* Crypto-1 演算法視覺化 */}
            <Crypto1Animation isActive={isPlaying && currentStep >= 2} />
          </div>

          {/* 側邊欄 */}
          <div className="space-y-4">
            {/* 驗證步驟列表 */}
            <motion.div 
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 shadow-lg"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ChevronRight size={20} />
                驗證步驟
              </h3>
              <div className="space-y-2">
                {authSteps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      index === currentStep
                        ? "bg-green-600 text-white shadow-lg"
                        : index < currentStep
                        ? "bg-emerald-900/30 text-emerald-400"
                        : "bg-slate-700/30 text-slate-400 hover:bg-slate-700/50"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        index === currentStep
                          ? "bg-white text-green-600"
                          : index < currentStep
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{step.title}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* 金鑰結構視覺化 */}
            <CardInfoStructure isActive={isPlaying && currentStep >= 5} />
          </div>
        </div>
      </div>
    </div>
  );
}
