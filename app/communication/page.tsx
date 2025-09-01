"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Step {
  id: number;
  title: string;
  description: string;
  readerAction: string;
  cardAction: string;
  data?: string;
}

const communicationSteps: Step[] = [
  {
    id: 1,
    title: "RF 場域建立",
    description: "讀卡機開啟 13.56 MHz 的射頻場域，為卡片提供電力",
    readerAction: "發送載波信號",
    cardAction: "接收電力並啟動",
  },
  {
    id: 2,
    title: "REQA 請求",
    description: "讀卡機發送 REQA 命令，詢問是否有卡片存在",
    readerAction: "發送 REQA (0x26)",
    cardAction: "等待命令",
    data: "0x26",
  },
  {
    id: 3,
    title: "ATQA 回應",
    description: "卡片回應 ATQA，告知讀卡機其存在及基本資訊",
    readerAction: "等待回應",
    cardAction: "發送 ATQA",
    data: "0x0004",
  },
  {
    id: 4,
    title: "防碰撞程序",
    description: "進行防碰撞程序，確保只與一張卡片通訊",
    readerAction: "發送 SEL_CL1",
    cardAction: "參與防碰撞",
    data: "0x93 0x20",
  },
  {
    id: 5,
    title: "UID 交換",
    description: "卡片傳送其唯一識別碼 (UID)",
    readerAction: "接收 UID",
    cardAction: "發送 UID",
    data: "0x12345678",
  },
  {
    id: 6,
    title: "卡片選取",
    description: "讀卡機選取特定卡片進行後續通訊",
    readerAction: "發送 SELECT",
    cardAction: "確認選取",
    data: "0x93 0x70 + UID",
  },
  {
    id: 7,
    title: "SAK 回應",
    description: "卡片發送 SAK (Select Acknowledge)，確認選取成功",
    readerAction: "等待確認",
    cardAction: "發送 SAK",
    data: "0x08",
  },
];

export default function CommunicationPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentStep < communicationSteps.length - 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => prev + 1);
      }, 3000);
    } else if (currentStep >= communicationSteps.length - 1) {
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
              <div className="flex items-center justify-between mb-8">
                <div className="text-center">
                  <div className="w-24 h-32 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg mb-4 mx-auto shadow-lg">
                    <div className="w-full h-full flex items-center justify-center text-white font-bold">
                      讀卡機
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">Reader</p>
                </div>

                {/* 通訊動畫區域 */}
                <div className="flex-1 mx-8 relative">
                  <div className="h-px bg-slate-600 w-full"></div>
                  
                  {/* 數據傳輸動畫 */}
                  <AnimatePresence>
                    {currentStep < communicationSteps.length && (
                      <motion.div
                        key={`step-${currentStep}`}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 50, opacity: 0 }}
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
                      >
                        {communicationSteps[currentStep]?.data || "通訊中..."}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-blue-500"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* RF 場域指示 */}
                  <motion.div
                    animate={{
                      opacity: currentStep >= 0 ? [0.3, 0.7, 0.3] : 0,
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute -top-12 -bottom-12 left-0 right-0 border-2 border-dashed border-yellow-400 rounded-lg"
                  >
                    <span className="absolute -top-6 left-2 text-yellow-400 text-xs">
                      RF Field (13.56 MHz)
                    </span>
                  </motion.div>
                </div>

                <div className="text-center">
                  <div className="w-20 h-28 bg-gradient-to-b from-purple-500 to-purple-700 rounded-lg mb-4 mx-auto shadow-lg">
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                      Mifare
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">Card</p>
                </div>
              </div>

              {/* 當前步驟資訊 */}
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">
                  步驟 {currentStep + 1}: {communicationSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-4">
                  {communicationSteps[currentStep]?.description}
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-900/30 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-400 mb-2">讀卡機動作</h4>
                    <p className="text-sm">{communicationSteps[currentStep]?.readerAction}</p>
                  </div>
                  <div className="bg-purple-900/30 p-4 rounded-lg">
                    <h4 className="font-bold text-purple-400 mb-2">卡片動作</h4>
                    <p className="text-sm">{communicationSteps[currentStep]?.cardAction}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 進度條 */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">進度</span>
                <span className="text-sm text-slate-400">
                  {currentStep + 1} / {communicationSteps.length}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / communicationSteps.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* 側邊欄 - 步驟列表 */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ChevronRight size={20} />
                通訊步驟
              </h3>
              <div className="space-y-2">
                {communicationSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      index === currentStep
                        ? "bg-blue-600 text-white"
                        : index < currentStep
                        ? "bg-green-900/30 text-green-400"
                        : "bg-slate-700/30 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        index === currentStep
                          ? "bg-white text-blue-600"
                          : index < currentStep
                          ? "bg-green-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{step.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 技術細節 */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-between w-full text-xl font-bold mb-4"
              >
                技術細節
                <motion.div
                  animate={{ rotate: showDetails ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight size={20} />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2">頻率規格</h4>
                      <p className="text-sm text-slate-300">13.56 MHz ± 7 kHz</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2">調變方式</h4>
                      <p className="text-sm text-slate-300">ASK (Amplitude Shift Keying)</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2">資料傳輸率</h4>
                      <p className="text-sm text-slate-300">106 kbit/s</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-400 mb-2">通訊距離</h4>
                      <p className="text-sm text-slate-300">最大 10 cm</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
