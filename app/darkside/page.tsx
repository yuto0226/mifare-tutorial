"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw, Zap, AlertTriangle, Target } from "lucide-react";
import Link from "next/link";

interface DarksideStep {
  id: number;
  title: string;
  description: string;
  phase: string;
  attackerAction: string;
  cardResponse: string;
  errorType: string;
  details: string;
}

const darksideSteps: DarksideStep[] = [
  {
    id: 1,
    title: "發起認證請求",
    description: "攻擊者向目標扇區發送認證命令",
    phase: "初始化階段",
    attackerAction: "AUTH: 60 04 (目標扇區)",
    cardResponse: "nT: 1A2B3C4D",
    errorType: "正常流程",
    details: "Darkside Attack 不需要任何已知金鑰。攻擊者直接對目標扇區發起認證請求，獲取卡片發送的隨機數 nT。這個 nT 值將作為後續攻擊的基礎。",
  },
  {
    id: 2,
    title: "發送無效認證",
    description: "故意發送錯誤的認證數據觸發卡片錯誤",
    phase: "錯誤注入",
    attackerAction: "無效 aR: FFFFFFFF",
    cardResponse: "4-bit 錯誤碼",
    errorType: "認證失敗",
    details: "攻擊者故意發送錯誤的認證響應 aR。卡片檢測到錯誤後，會發送一個 4-bit 的錯誤響應。關鍵漏洞：這個錯誤響應包含了關於正確金鑰的部分資訊。",
  },
  {
    id: 3,
    title: "Parity 錯誤分析",
    description: "分析錯誤響應中的 parity bit 資訊",
    phase: "資訊洩露分析",
    attackerAction: "分析 4-bit 錯誤",
    cardResponse: "Parity: 1011",
    errorType: "資訊洩露",
    details: "卡片的錯誤響應不僅表示認證失敗，還包含了關鍵的 parity 資訊。這些 parity bit 與正確金鑰的某些位元有直接關係，為攻擊者提供了金鑰的部分資訊。",
  },
  {
    id: 4,
    title: "重複錯誤注入",
    description: "使用不同錯誤值收集更多 parity 資訊",
    phase: "資料收集",
    attackerAction: "系統性錯誤注入",
    cardResponse: "多組 Parity 數據",
    errorType: "多重洩露",
    details: "攻擊者系統性地發送不同的錯誤認證數據，每次都會獲得對應的 parity 錯誤資訊。通過收集大量的 parity 數據，可以建立關於正確金鑰的約束方程組。",
  },
  {
    id: 5,
    title: "建立金鑰約束",
    description: "利用 parity 資訊建立金鑰位的約束關係",
    phase: "數學分析",
    attackerAction: "建立線性方程組",
    cardResponse: "金鑰約束: 32 個方程",
    errorType: "結構化洩露",
    details: "每個 parity 錯誤提供一個關於金鑰位的線性約束。收集足夠的約束後，可以建立一個線性方程組。這個方程組大幅減少了需要搜索的金鑰空間。",
  },
  {
    id: 6,
    title: "金鑰空間縮減",
    description: "解析約束方程，確定大部分金鑰位",
    phase: "約束求解", 
    attackerAction: "解線性方程組",
    cardResponse: "48-bit → ~16-bit 搜索",
    errorType: "空間縮減",
    details: "通過解析收集到的約束方程組，可以直接確定大部分金鑰位的值。通常可以將 48-bit 的搜索空間縮減到只有 16-bit 左右，大幅提高破解效率。",
  },
  {
    id: 7,
    title: "暴力搜索剩餘位",
    description: "對縮減後的金鑰空間進行快速暴力搜索",
    phase: "金鑰恢復",
    attackerAction: "暴力搜索 2^16 空間",
    cardResponse: "金鑰驗證測試",
    errorType: "搜索優化",
    details: "縮減後的搜索空間只有約 65536 個可能的金鑰，即使使用普通硬體也能在幾秒到幾分鐘內完成搜索。每個候選金鑰都可以快速驗證其正確性。",
  },
  {
    id: 8,
    title: "金鑰驗證成功",
    description: "找到正確金鑰，完成攻擊",
    phase: "攻擊完成",
    attackerAction: "使用恢復的金鑰",
    cardResponse: "認證成功",
    errorType: "攻擊成功",
    details: "攻擊成功後，攻擊者獲得目標扇區的金鑰。整個攻擊過程通常只需要幾分鐘，且成功率接近 100%。這使得 Darkside Attack 成為對 Mifare Classic 最有效的攻擊方法之一。",
  },
];

export default function DarksideAttackPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= darksideSteps.length - 1) {
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

  const getErrorTypeColor = (errorType: string) => {
    switch (errorType) {
      case "正常流程": return "text-blue-400 border-blue-500/30 bg-blue-900/20";
      case "認證失敗": return "text-yellow-400 border-yellow-500/30 bg-yellow-900/20";
      case "資訊洩露": return "text-orange-400 border-orange-500/30 bg-orange-900/20";
      case "多重洩露": return "text-red-400 border-red-500/30 bg-red-900/20";
      case "結構化洩露": return "text-purple-400 border-purple-500/30 bg-purple-900/20";
      case "空間縮減": return "text-pink-400 border-pink-500/30 bg-pink-900/20";
      case "搜索優化": return "text-green-400 border-green-500/30 bg-green-900/20";
      case "攻擊成功": return "text-red-400 border-red-500/30 bg-red-900/20";
      default: return "text-slate-400 border-slate-500/30 bg-slate-900/20";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl pb-20 lg:pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 sm:mb-8 flex-col sm:flex-row gap-4 sm:gap-0"
        >
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <Link href="/" className="text-orange-400 hover:text-orange-300 transition-colors flex-shrink-0">
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
              </Link>
            </motion.div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Darkside Attack
            </h1>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <motion.button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors shadow-lg text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying ? <Pause size={16} className="sm:w-5 sm:h-5" /> : <Play size={16} className="sm:w-5 sm:h-5" />}
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

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* 主要動畫區域 */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl lg:rounded-2xl p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6"
            >
              {/* 當前步驟標題 */}
              <div className="text-center mb-4 sm:mb-6 lg:mb-8">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                  步驟 {currentStep + 1}: {darksideSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-3 sm:mb-4 text-sm sm:text-base">
                  {darksideSteps[currentStep]?.description}
                </p>
                <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
                  <div className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-orange-400 text-xs sm:text-sm">
                    <Zap size={12} className="sm:w-4 sm:h-4" />
                    {darksideSteps[currentStep]?.phase}
                  </div>
                  <div className={`inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${getErrorTypeColor(darksideSteps[currentStep]?.errorType)}`}>
                    <AlertTriangle size={12} className="sm:w-4 sm:h-4" />
                    {darksideSteps[currentStep]?.errorType}
                  </div>
                </div>
              </div>

              {/* 攻擊動畫區域 */}
              <div className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-3 sm:p-6 lg:p-8 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
                  {/* 攻擊者 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: [1, 1.15, 1],
                        boxShadow: [
                          '0 0 0px rgba(251, 146, 60, 0.5)', 
                          '0 0 25px rgba(251, 146, 60, 0.9)', 
                          '0 0 0px rgba(251, 146, 60, 0.5)'
                        ]
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity,
                        repeatType: "reverse"
                      }}
                      className="w-16 h-20 sm:w-20 sm:h-24 lg:w-24 lg:h-32 bg-gradient-to-b from-orange-500 to-red-600 rounded-lg mb-2 sm:mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <Target size={16} className="sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
                    </motion.div>
                    <p className="text-xs sm:text-sm text-slate-400">Darkside 攻擊者</p>
                  </div>

                  {/* 錯誤注入動畫 */}
                  <div className="flex-1 mx-4 sm:mx-6 lg:mx-8 relative h-12 sm:h-16 lg:h-24 flex flex-col items-center justify-center">
                    {/* 攻擊波形 */}
                    <motion.div
                      animate={{
                        scaleX: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute w-full h-1 sm:h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full"
                    />
                    
                    {/* 錯誤注入指示器 */}
                    <motion.div
                      animate={{
                        rotate: [0, 180, 360],
                        scale: [0.8, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-red-500 rounded-full flex items-center justify-center mb-1 sm:mb-2"
                    >
                      <Zap size={10} className="sm:w-3 sm:h-3 lg:w-5 lg:h-5 text-white" />
                    </motion.div>
                    
                    {/* 資料流 */}
                    <div className="text-center">
                      <div className="mb-0.5 sm:mb-1">
                        <motion.div
                          animate={{
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                          }}
                          className="text-orange-400 text-xs sm:text-sm font-mono bg-slate-800/70 px-1 sm:px-2 py-1 rounded"
                        >
                          {darksideSteps[currentStep]?.attackerAction}
                        </motion.div>
                      </div>
                      <div className="text-blue-400 text-xs sm:text-sm font-mono bg-slate-800/70 px-1 sm:px-2 py-1 rounded">
                        {darksideSteps[currentStep]?.cardResponse}
                      </div>
                    </div>

                    {/* Parity 錯誤可視化 */}
                    {currentStep >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -bottom-2 sm:-bottom-3 lg:-bottom-4 flex gap-1"
                      >
                        {[1, 0, 1, 1].map((bit, index) => (
                          <motion.div
                            key={index}
                            animate={{
                              backgroundColor: bit === 1 ? ['#ef4444', '#f97316', '#ef4444'] : ['#374151', '#4b5563', '#374151'],
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: index * 0.2,
                            }}
                            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full border border-slate-600"
                          />
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* 目標卡片 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        boxShadow: currentStep >= 7 ? 
                          ['0 0 0px rgba(239, 68, 68, 0.5)', '0 0 20px rgba(239, 68, 68, 0.8)', '0 0 0px rgba(239, 68, 68, 0.5)'] :
                          currentStep >= 2 ?
                          ['0 0 0px rgba(251, 146, 60, 0.5)', '0 0 15px rgba(251, 146, 60, 0.7)', '0 0 0px rgba(251, 146, 60, 0.5)'] :
                          ['0 0 0px rgba(59, 130, 246, 0.5)', '0 0 10px rgba(59, 130, 246, 0.6)', '0 0 0px rgba(59, 130, 246, 0.5)']
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-16 h-20 sm:w-20 sm:h-24 lg:w-24 lg:h-32 bg-gradient-to-b ${
                        currentStep >= 7 ? 'from-red-500 to-red-700' : 
                        currentStep >= 2 ? 'from-orange-500 to-red-600' :
                        'from-blue-500 to-blue-700'
                      } rounded-lg mb-2 sm:mb-4 mx-auto shadow-lg flex items-center justify-center`}
                    >
                      <span className="text-white text-lg sm:text-xl lg:text-2xl">💳</span>
                    </motion.div>
                    <p className="text-xs sm:text-sm text-slate-400">Mifare 卡片</p>
                  </div>
                </div>

                {/* 錯誤類型說明 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg p-4 border ${getErrorTypeColor(darksideSteps[currentStep]?.errorType)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} />
                    <span className="font-semibold text-sm">錯誤注入效果</span>
                  </div>
                  <p className="text-sm opacity-90">
                    {darksideSteps[currentStep]?.errorType}: 此階段的錯誤注入導致特定的卡片響應模式
                  </p>
                </motion.div>
              </div>

              {/* 攻擊原理說明 - 移到主要動畫區域下方 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900/30 border border-orange-500/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-bold mb-4 text-red-400 flex items-center gap-2">
                  <Zap size={18} />
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
                      {darksideSteps[currentStep]?.details}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>

            {/* 手機版步驟導航按鈕 - 固定在螢幕底部 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4 z-50"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => goToStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                    currentStep === 0
                      ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  <ArrowLeft size={16} />
                  上一步
                </button>
                
                <div className="text-center px-4">
                  <div className="text-sm font-medium text-white">
                    步驟 {currentStep + 1} / {darksideSteps.length}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {darksideSteps[currentStep]?.title}
                  </div>
                </div>
                
                <button
                  onClick={() => goToStep(Math.min(darksideSteps.length - 1, currentStep + 1))}
                  disabled={currentStep === darksideSteps.length - 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                    currentStep === darksideSteps.length - 1
                      ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  下一步
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 - 只在大螢幕顯示 */}
          <div className="hidden lg:block space-y-4 sm:space-y-6 lg:max-h-[calc(100vh-12rem)] flex flex-col order-1 lg:order-2">
            {/* 步驟導航 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 flex-1 flex flex-col min-h-0"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 flex-shrink-0">
                <Zap size={16} className="sm:w-5 sm:h-5 text-orange-400" />
                攻擊步驟
              </h3>
              <div className="flex lg:flex-col gap-2 lg:gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto flex-1 lg:pr-2 pb-2 lg:pb-0 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                {darksideSteps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`flex-shrink-0 lg:w-full text-left p-2 sm:p-3 rounded-lg transition-all duration-300 min-w-[200px] lg:min-w-0 min-h-[44px] ${
                      index === currentStep
                        ? "bg-orange-600/30 border border-orange-500/50 text-white shadow-lg"
                        : index < currentStep
                        ? "bg-amber-900/30 text-amber-400"
                        : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === currentStep
                          ? "bg-orange-500 text-white"
                          : index < currentStep
                          ? "bg-amber-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{step.title}</p>
                        <p className="text-xs opacity-75 truncate hidden sm:block lg:block">{step.phase}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* 攻擊特性 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 flex-shrink-0"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-orange-400">攻擊特性</h3>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>無需已知金鑰</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>攻擊時間短（分鐘級）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span>成功率接近 100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span>需要錯誤注入能力</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
