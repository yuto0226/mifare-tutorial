"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, Shield, Target } from "lucide-react";
import Link from "next/link";

interface NestedStep {
  id: number;
  title: string;
  description: string;
  phase: string;
  attackerAction: string;
  cardResponse: string;
  vulnerability: string;
  details: string;
}

const nestedSteps: NestedStep[] = [
  {
    id: 1,
    title: "檢測卡片類型",
    description: "Proxmark3 檢測卡片並確認為 Mifare Classic",
    phase: "初始化",
    attackerAction: "hf 14a info",
    cardResponse: "ATQA: 0004, SAK: 08 (1K)",
    vulnerability: "卡片身份公開可見",
    details: "使用 Proxmark3 的 'hf 14a info' 命令檢測卡片類型。系統會顯示 ATQA (Answer To reQuest A) 和 SAK (Select AcKnowledge) 資訊，確認這是一張 Mifare Classic 1K 卡片，具有 16 個扇區。",
  },
  {
    id: 2,
    title: "測試預設金鑰",
    description: "嘗試使用常見的預設金鑰進行驗證",
    phase: "金鑰探測",
    attackerAction: "hf mf chk --1k",
    cardResponse: "Found Key A: FFFFFFFFFFFF",
    vulnerability: "使用預設金鑰或弱金鑰",
    details: "Proxmark3 的 'hf mf chk' 命令會測試常見的預設金鑰，如 FFFFFFFFFFFF、A0A1A2A3A4A5、D3F7D3F7D3F7 等。通常至少會找到一個可用的金鑰，這是 Nested Attack 的必要條件。",
  },
  {
    id: 3,
    title: "執行 Nested Attack",
    description: "使用已知金鑰對其他扇區執行 nested 攻擊",
    phase: "主要攻擊",
    attackerAction: "hf mf nested --1k --blk 0 -a -k FFFFFFFFFFFF",
    cardResponse: "Collecting nonces...",
    vulnerability: "Crypto-1 PRNG 的可預測性",
    details: "核心命令 'hf mf nested'。使用已知的扇區 0 Key A (FFFFFFFFFFFF) 作為攻擊起點。Proxmark3 會對每個目標扇區執行嵌套認證，收集加密的 nonce 數據。每次認證都會生成新的挑戰-回應對。",
  },
  {
    id: 4,
    title: "收集加密 Nonces",
    description: "從每個目標扇區收集加密的挑戰回應",
    phase: "數據採集",
    attackerAction: "Target sector: 4, nonces: 500",
    cardResponse: "Encrypted nT: 0x12345678",
    vulnerability: "加密通道中的 nonce 洩漏資訊",
    details: "對每個扇區，Proxmark3 會收集約 500-1000 個加密的 nonce。這些 nonce 是在已建立的加密通道中傳輸的，但它們的產生模式仍然暴露了 PRNG 的內部狀態資訊。",
  },
  {
    id: 5,
    title: "分析 PRNG 狀態",
    description: "分析收集的數據以重建 PRNG 內部狀態",
    phase: "密碼分析",
    attackerAction: "分析 nonce 序列模式",
    cardResponse: "LFSR 狀態推導中...",
    vulnerability: "16-bit LFSR 的有限狀態空間",
    details: "Proxmark3 內建的密碼分析演算法會分析收集到的 nonce 序列。由於 Mifare Classic 的 PRNG 基於 16-bit LFSR，只有 65536 個可能狀態，這使得狀態重建在計算上是可行的。",
  },
  {
    id: 6,
    title: "計算金鑰候選",
    description: "基於推導的狀態計算可能的金鑰",
    phase: "金鑰推導",
    attackerAction: "生成金鑰候選列表",
    cardResponse: "候選金鑰: 2^20 個",
    vulnerability: "Crypto-1 初始化的數學弱點",
    details: "利用重建的 PRNG 狀態和 Crypto-1 演算法的已知弱點，Proxmark3 可以將 48-bit 的金鑰空間縮減到約 2^20 個候選。這是通過逆向 Crypto-1 的金鑰排程演算法實現的。",
  },
  {
    id: 7,
    title: "暴力搜索驗證",
    description: "測試金鑰候選直到找到正確金鑰",
    phase: "驗證階段",
    attackerAction: "Testing key candidates...",
    cardResponse: "Found Key: A1B2C3D4E5F6",
    vulnerability: "縮減的搜索空間可快速窮舉",
    details: "Proxmark3 會自動測試所有金鑰候選。由於搜索空間已大幅縮減，這個過程通常在幾分鐘內完成。每個候選金鑰都會通過實際的認證測試來驗證其正確性。",
  },
  {
    id: 8,
    title: "輸出完整金鑰",
    description: "顯示所有成功破解的扇區金鑰",
    phase: "結果輸出",
    attackerAction: "hf mf nested --1k --dump",
    cardResponse: "All keys found: 16 sectors",
    vulnerability: "整張卡片的安全性被完全破壞",
    details: "攻擊完成後，Proxmark3 會顯示所有扇區的 Key A 和 Key B。使用 '--dump' 參數可以將結果保存到檔案。此時攻擊者擁有卡片的完整控制權，可以讀寫任意扇區的數據。",
  },
];

export default function NestedAttackPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= nestedSteps.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      }, 4000);
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
            <Link href="/" className="text-red-400 hover:text-red-300 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Nested Attack 實戰分析
            </h1>
            <p className="text-slate-400 text-sm mt-2">基於 Proxmark3 Iceman 版本的實際攻擊流程</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? "暫停" : "播放"}
            </button>
            <button
              onClick={resetAnimation}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RotateCcw size={20} />
              重置
            </button>
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
                  步驟 {currentStep + 1}: {nestedSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-4">
                  {nestedSteps[currentStep]?.description}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-500/30 rounded-full text-red-400 text-sm">
                  <Shield size={14} />
                  {nestedSteps[currentStep]?.phase}
                </div>
              </div>

              {/* 攻擊動畫區域 */}
              <div className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-8 mb-6">
                <div className="flex items-center justify-between mb-8">
                  {/* 攻擊者 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: [1, 1.1, 1],
                        boxShadow: [
                          '0 0 0px rgba(239, 68, 68, 0.5)', 
                          '0 0 20px rgba(239, 68, 68, 0.8)', 
                          '0 0 0px rgba(239, 68, 68, 0.5)'
                        ]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatType: "reverse"
                      }}
                      className="w-24 h-32 bg-gradient-to-b from-red-500 to-red-700 rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <Target size={32} className="text-white" />
                    </motion.div>
                    <p className="text-sm text-slate-400">攻擊者 (Proxmark3)</p>
                  </div>

                  {/* 攻擊流程動畫 */}
                  <div className="flex-1 mx-8 relative h-20 flex items-center">
                    {/* 攻擊向量 */}
                    <motion.div
                      animate={{
                        x: [0, 50, 0],
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute left-0 w-6 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                    />
                    
                    {/* 資料流 */}
                    <div className="w-full text-center">
                      <div className="mb-2">
                        <motion.div
                          animate={{
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                          }}
                          className="text-orange-400 text-xs font-mono bg-slate-800/70 px-2 py-1 rounded"
                        >
                          {nestedSteps[currentStep]?.attackerAction}
                        </motion.div>
                      </div>
                      <div className="text-blue-400 text-xs font-mono bg-slate-800/70 px-2 py-1 rounded">
                        {nestedSteps[currentStep]?.cardResponse}
                      </div>
                    </div>

                    {/* 反向數據流 */}
                    <motion.div
                      animate={{
                        x: [0, -50, 0],
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1.5,
                      }}
                      className="absolute right-0 w-6 h-1 bg-gradient-to-l from-blue-500 to-cyan-500 rounded-full"
                    />
                  </div>

                  {/* 目標卡片 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        boxShadow: currentStep >= 7 ? 
                          ['0 0 0px rgba(239, 68, 68, 0.5)', '0 0 20px rgba(239, 68, 68, 0.8)', '0 0 0px rgba(239, 68, 68, 0.5)'] :
                          ['0 0 0px rgba(59, 130, 246, 0.5)', '0 0 10px rgba(59, 130, 246, 0.6)', '0 0 0px rgba(59, 130, 246, 0.5)']
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`w-24 h-32 bg-gradient-to-b ${currentStep >= 7 ? 'from-red-500 to-red-700' : 'from-blue-500 to-blue-700'} rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center`}
                    >
                      <span className="text-white text-2xl">💳</span>
                    </motion.div>
                    <p className="text-sm text-slate-400">Mifare 卡片</p>
                  </div>
                </div>

                {/* 漏洞說明 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-900/20 border border-red-500/30 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-red-400" />
                    <span className="text-red-400 font-semibold text-sm">安全漏洞</span>
                  </div>
                  <p className="text-slate-300 text-sm">
                    {nestedSteps[currentStep]?.vulnerability}
                  </p>
                </motion.div>
              </div>

              {/* 攻擊原理說明 - 移到主要動畫區域下方 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900/30 border border-red-500/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-bold mb-4 text-orange-400 flex items-center gap-2">
                  <Shield size={18} />
                  攻擊原理
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {nestedSteps[currentStep]?.details}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* 側邊欄 */}
          <div className="space-y-6">
            {/* 步驟導航 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 max-h-[calc(100vh-12rem)] flex flex-col"
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 flex-shrink-0">
                <Shield size={18} className="text-red-400" />
                攻擊步驟
              </h3>
              <div className="space-y-2 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                {nestedSteps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-300 ${
                      index === currentStep
                        ? "bg-red-600/30 border border-red-500/50 text-white shadow-lg"
                        : index < currentStep
                        ? "bg-pink-900/30 text-pink-400"
                        : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === currentStep
                          ? "bg-red-500 text-white"
                          : index < currentStep
                          ? "bg-pink-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-xs opacity-75">{step.phase}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
