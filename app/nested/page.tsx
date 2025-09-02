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
    title: "建立初始認證",
    description: "攻擊者使用已知金鑰進行合法認證",
    phase: "準備階段",
    attackerAction: "AUTH: 60 04 (已知金鑰)",
    cardResponse: "認證成功，建立安全通道",
    vulnerability: "需要至少一個已知金鑰作為攻擊起點",
    details: "Nested Attack 的前提是攻擊者已經獲得至少一個扇區的金鑰（通常是預設金鑰 FFFFFFFFFFFF 或弱金鑰）。攻擊者使用此金鑰與卡片建立合法的認證連接。",
  },
  {
    id: 2,
    title: "發起嵌套認證",
    description: "在已認證狀態下，對目標扇區發起新的認證請求",
    phase: "攻擊階段",
    attackerAction: "AUTH: 60 08 (目標扇區)",
    cardResponse: "nT: A5B6C7D8 (明文)",
    vulnerability: "Crypto-1 在嵌套認證時的 PRNG 狀態可預測",
    details: "關鍵漏洞：在已建立的安全通道內發起新的認證時，卡片的 PRNG 狀態是可預測的。新的 nT 值雖然看似隨機，但實際上與當前的 Crypto-1 LFSR 狀態有關聯性。",
  },
  {
    id: 3,
    title: "收集認證序列",
    description: "重複嵌套認證過程，收集多組 nT 值",
    phase: "數據收集",
    attackerAction: "重複 AUTH 命令",
    cardResponse: "nT₁, nT₂, nT₃... (序列)",
    vulnerability: "PRNG 的線性特性暴露內部狀態",
    details: "攻擊者收集大量的 nT 值序列。由於 Mifare Classic 使用的是 16-bit LFSR 作為 PRNG，其輸出具有線性關係。通過分析這些序列，可以推導出 LFSR 的內部狀態和反饋函數。",
  },
  {
    id: 4,
    title: "nT 預測分析",
    description: "分析 nT 序列的模式，建立預測模型",
    phase: "分析階段", 
    attackerAction: "分析 PRNG 狀態轉換",
    cardResponse: "LFSR 狀態: S₁→S₂→S₃",
    vulnerability: "16-bit LFSR 的狀態空間過小",
    details: "通過分析收集到的 nT 序列，攻擊者可以重建 PRNG 的狀態轉換圖。16-bit LFSR 只有 65536 個可能狀態，可以通過數學分析或暴力搜索確定當前狀態。",
  },
  {
    id: 5,
    title: "Crypto-1 狀態恢復",
    description: "利用已知的 nT 值反推 Crypto-1 的內部狀態",
    phase: "狀態恢復",
    attackerAction: "計算 LFSR 反向狀態",
    cardResponse: "Crypto-1 狀態已知",
    vulnerability: "認證過程中 LFSR 狀態與 nT 的關聯性",
    details: "一旦能夠預測 nT，攻擊者就可以模擬正常的認證過程。通過已知的 nT 值和認證協定的數學關係，可以反推出發送 nT 時的 Crypto-1 LFSR 狀態。",
  },
  {
    id: 6,
    title: "金鑰空間縮減",
    description: "利用已知狀態大幅縮減金鑰搜索空間",
    phase: "優化階段",
    attackerAction: "計算可能金鑰範圍",
    cardResponse: "48-bit → ~20-bit 搜索空間",
    vulnerability: "Crypto-1 初始化過程的可逆性",
    details: "知道特定時刻的 LFSR 狀態後，可以反推初始化時使用的金鑰。由於 Crypto-1 的初始化是確定性的，大部分金鑰位可以直接計算得出，只需要暴力搜索剩餘的少數位。",
  },
  {
    id: 7,
    title: "目標金鑰破解",
    description: "對縮減後的金鑰空間進行暴力搜索",
    phase: "破解階段",
    attackerAction: "暴力搜索剩餘金鑰位",
    cardResponse: "金鑰驗證成功",
    vulnerability: "縮減後的搜索空間可在短時間內破解",
    details: "由於搜索空間已大幅縮減（從 2⁴⁸ 減少到約 2²⁰），即使使用普通硬體也能在短時間內（通常幾分鐘到幾小時）完成暴力搜索，成功恢復目標扇區的金鑰。",
  },
  {
    id: 8,
    title: "攻擊完成",
    description: "成功獲取目標扇區金鑰，可進行讀寫操作",
    phase: "完成階段",
    attackerAction: "使用破解的金鑰存取",
    cardResponse: "完全存取權限",
    vulnerability: "整個扇區的安全性被完全破壞",
    details: "攻擊成功後，攻擊者獲得目標扇區的完整存取權限。可以重複此過程攻擊其他扇區，直到獲取整張卡片的控制權。這種攻擊的成功率很高，且只需要一個已知金鑰作為起點。",
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
              Nested Attack 分析
            </h1>
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
                    <p className="text-sm text-slate-400">攻擊者 (Attacker)</p>
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
