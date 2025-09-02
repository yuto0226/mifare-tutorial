"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";
import Link from "next/link";

interface Step {
  id: number;
  title: string;
  description: string;
  data?: string;
  dataDirection: 'reader-to-card' | 'card-to-reader' | 'both' | 'none';
  details: string;
}

const communicationSteps: Step[] = [
  {
    id: 1,
    title: "RF 場域建立",
    description: "讀卡機建立 13.56 MHz 載波信號，為無源卡片提供電力",
    dataDirection: 'none',
    details: "讀卡機的 RF 發射器產生連續的 13.56 MHz 載波信號。卡片內的 LC 共振電路在此頻率下達到最佳能量傳輸效率，為卡片提供足夠的工作電壓（通常 3.3V）。",
  },
  {
    id: 2,
    title: "REQA 廣播",
    description: "讀卡機廣播 REQA 命令，尋找場域內的 Type A 卡片",
    data: "REQA: 0x26",
    dataDirection: 'reader-to-card',
    details: "REQA (REQuest Type A) 是 ISO 14443-3 定義的喚醒命令。使用 Modified Miller 編碼，不含 CRC。只有處於 IDLE 狀態的 Type A 卡片會回應此命令。",
  },
  {
    id: 3,
    title: "ATQA 回應",
    description: "卡片回應 ATQA，告知讀卡機自身的基本特性",
    data: "ATQA: 0x0004",
    dataDirection: 'card-to-reader',
    details: "ATQA (Answer To request Type A) 包含 UID 長度、Bit Frame Anticollision 支援等資訊。0x0004 表示 4-byte UID 且支援 ISO 14443-4 相容性。使用 Manchester 編碼傳輸。",
  },
  {
    id: 4,
    title: "防碰撞初始化",
    description: "讀卡機啟動防碰撞程序，準備處理多卡片環境",
    data: "SELECT: 0x93 0x20",
    dataDirection: 'reader-to-card',
    details: "SELECT 命令啟動 Cascade Level 1 的防碰撞程序。0x93 表示 CL1，0x20 表示 NVB (Number of Valid Bits) = 2 bytes，即完整的 SELECT 命令。",
  },
  {
    id: 5,
    title: "UID 傳輸與碰撞檢測",
    description: "所有卡片同時傳送 UID，讀卡機檢測並解決碰撞",
    data: "UID: 4 bytes + BCC",
    dataDirection: 'card-to-reader',
    details: "多張卡片同時回應時，在 UID 不同的位置會產生碰撞。讀卡機檢測到碰撞後，會指定該位的值 (0 或 1)，只有符合的卡片繼續回應，實現 O(n) 複雜度的卡片分離。",
  },
  {
    id: 6,
    title: "卡片選取",
    description: "讀卡機選取特定卡片，建立獨占通訊",
    data: "SELECT: 0x93 0x70 + UID + CRC",
    dataDirection: 'reader-to-card',
    details: "SELECT 命令包含 NVB=0x70 (表示傳送完整 UID)、4-byte UID 和 2-byte CRC-A。只有 UID 完全匹配且 CRC 正確的卡片會進入 ACTIVE 狀態並回應。",
  },
  {
    id: 7,
    title: "SAK 確認",
    description: "被選中的卡片回應 SAK，確認選取完成並報告能力",
    data: "SAK: 0x08",
    dataDirection: 'card-to-reader',
    details: "SAK (Select AcKnowledge) bit 3 設為 1 表示 ISO 14443-4 不相容（Mifare Classic）。0x08 specifically 表示 Mifare Classic 1K。卡片現在處於 ACTIVE 狀態，可接受 Mifare 特定命令。",
  },
];

export default function CommunicationPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= communicationSteps.length - 1) {
            return 0; // 回到第一步，實現循環
          }
          return prev + 1;
        });
      }, 3000);
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
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Mifare Classic 通訊過程
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
                  步驟 {currentStep + 1}: {communicationSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-6">
                  {communicationSteps[currentStep]?.description}
                </p>
              </div>

              {/* 統一的通訊動畫區域 */}
              <div className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-8 mb-6">
                <div className="flex items-center justify-between mb-8">
                  {/* 讀卡機 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? [1, 1.1, 1] : 1,
                        boxShadow: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? 
                          ['0 0 0px rgba(59, 130, 246, 0.5)', '0 0 20px rgba(59, 130, 246, 0.8)', '0 0 0px rgba(59, 130, 246, 0.5)'] : 
                          '0 0 0px rgba(59, 130, 246, 0.5)'
                      }}
                      transition={{ duration: 1, repeat: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? Infinity : 0 }}
                      className="w-24 h-32 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-2xl">📡</span>
                    </motion.div>
                    <p className="text-sm text-slate-400">讀卡機 (Reader)</p>
                  </div>

                  {/* 資料傳輸動畫區域 */}
                  <div className="flex-1 mx-8 relative h-20 flex items-center">
                    {/* RF 場域背景 */}
                    <motion.div
                      animate={{
                        opacity: communicationSteps[currentStep]?.dataDirection === 'none' ? [0.3, 0.7, 0.3] : 0.2,
                      }}
                      transition={{
                        duration: 2,
                        repeat: communicationSteps[currentStep]?.dataDirection === 'none' ? Infinity : 0,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-lg"
                    >
                      <span className="absolute -top-6 left-2 text-yellow-400 text-xs">
                        RF Field (13.56 MHz)
                      </span>
                    </motion.div>
                    
                    {/* 資料封包動畫 */}
                    <AnimatePresence>
                      {communicationSteps[currentStep]?.data && communicationSteps[currentStep]?.dataDirection !== 'none' && (
                        <motion.div
                          key={`data-${currentStep}`}
                          initial={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? -120 : 120,
                            opacity: 0 
                          }}
                          animate={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? 120 : -120,
                            opacity: [0, 1, 1, 0] 
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="absolute bg-blue-500 text-white px-3 py-1 rounded text-sm font-mono whitespace-nowrap top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                        >
                          {communicationSteps[currentStep]?.data}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* 方向箭頭 */}
                    <div className="absolute inset-0 flex items-center justify-center z-0">
                      <motion.div
                        animate={{
                          opacity: communicationSteps[currentStep]?.dataDirection === 'none' ? [0.3, 1, 0.3] : [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: communicationSteps[currentStep]?.dataDirection === 'none' ? 1.5 : 1,
                          repeat: Infinity,
                        }}
                        className="text-3xl text-white"
                      >
                        {communicationSteps[currentStep]?.dataDirection === 'reader-to-card' && '→'}
                        {communicationSteps[currentStep]?.dataDirection === 'card-to-reader' && '←'}
                        {communicationSteps[currentStep]?.dataDirection === 'both' && '↔'}
                        {communicationSteps[currentStep]?.dataDirection === 'none' && '⚡'}
                      </motion.div>
                    </div>
                    
                    {/* 資料封包動畫 */}
                    <AnimatePresence>
                      {communicationSteps[currentStep]?.data && communicationSteps[currentStep]?.dataDirection !== 'none' && (
                        <motion.div
                          key={`data-${currentStep}`}
                          initial={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? -120 : 120,
                            opacity: 0 
                          }}
                          animate={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? 120 : -120,
                            opacity: [0, 1, 1, 1, 0] 
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.2, 0.8, 0.9, 1]
                          }}
                          className="absolute bg-blue-500 text-white px-3 py-1 rounded text-sm font-mono whitespace-nowrap top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
                        >
                          {communicationSteps[currentStep]?.data}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 卡片 */}
                  <div className="text-center">
                    <motion.div 
                      animate={{
                        scale: communicationSteps[currentStep]?.dataDirection === 'card-to-reader' ? [1, 1.1, 1] : 1,
                        boxShadow: communicationSteps[currentStep]?.dataDirection === 'card-to-reader' ? 
                          ['0 0 0px rgba(147, 51, 234, 0.5)', '0 0 20px rgba(147, 51, 234, 0.8)', '0 0 0px rgba(147, 51, 234, 0.5)'] : 
                          '0 0 0px rgba(147, 51, 234, 0.5)'
                      }}
                      transition={{ duration: 1, repeat: communicationSteps[currentStep]?.dataDirection === 'card-to-reader' ? Infinity : 0 }}
                      className="w-20 h-28 bg-gradient-to-b from-purple-500 to-purple-700 rounded-lg mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-2xl">💳</span>
                    </motion.div>
                    <p className="text-sm text-slate-400">卡片 (Mifare)</p>
                  </div>
                </div>

                {/* 流向與資料說明 */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-2">
                    <span className="text-slate-400 text-sm">資料流向：</span>
                    <span className="text-yellow-400 font-mono font-bold">
                      {communicationSteps[currentStep]?.dataDirection === 'reader-to-card' && '📡 讀卡機 → 卡片 💳'}
                      {communicationSteps[currentStep]?.dataDirection === 'card-to-reader' && '💳 卡片 → 讀卡機 📡'}
                      {communicationSteps[currentStep]?.dataDirection === 'both' && '📡 ↔ 💳 雙向通訊'}
                      {communicationSteps[currentStep]?.dataDirection === 'none' && '⚡ 電力場域建立'}
                    </span>
                    {communicationSteps[currentStep]?.data && (
                      <>
                        <span className="text-slate-400 text-sm">資料：</span>
                        <span className="text-blue-400 font-mono font-bold">
                          {communicationSteps[currentStep]?.data}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 通訊原理說明 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900/30 border border-blue-500/20 rounded-lg p-6"
              >
                <h3 className="text-lg font-bold mb-4 text-cyan-400 flex items-center gap-2">
                  <span className="text-xl">📡</span>
                  通訊原理
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
                      {communicationSteps[currentStep]?.details}
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
                <span className="text-blue-400">📡</span>
                通訊步驟
              </h3>
              <div className="space-y-2 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                {communicationSteps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-300 ${
                      index === currentStep
                        ? "bg-blue-600/30 border border-blue-500/50 text-white shadow-lg"
                        : index < currentStep
                        ? "bg-cyan-900/30 text-cyan-400"
                        : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === currentStep
                          ? "bg-blue-500 text-white"
                          : index < currentStep
                          ? "bg-cyan-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-xs opacity-75">ISO 14443-3 協定</p>
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
