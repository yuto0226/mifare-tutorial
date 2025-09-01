"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Pause, RotateCcw, ChevronRight, Key, Shield, Lock } from "lucide-react";
import Link from "next/link";

interface AuthStep {
  id: number;
  title: string;
  description: string;
  phase: string;
  readerData: string;
  cardData: string;
  explanation: string;
  details: string; // 整合的技術說明
}

const authSteps: AuthStep[] = [
  {
    id: 1,
    title: "選擇驗證目標",
    description: "讀卡機指定要存取的扇區並選擇金鑰類型",
    phase: "初始化",
    readerData: "發送 AUTH_A 命令 + 區塊地址 (例: 0x60 0x04)",
    cardData: "接收驗證請求，準備進行金鑰 A 的驗證程序",
    explanation: "讀卡機指定使用金鑰 A 驗證第 4 區塊，用於讀取扇區 1 的資料",
    details: "AUTH_A (0x60) 命令指定使用金鑰 A 進行驗證，後接區塊地址。每個扇區都有獨立的金鑰，用於不同用途的資料保護。典型執行時間約 500μs。",
  },
  {
    id: 2,
    title: "卡片挑戰",
    description: "卡片產生隨機數並傳送給讀卡機作為加密挑戰",
    phase: "挑戰階段",
    readerData: "等待接收卡片產生的隨機挑戰數",
    cardData: "產生 4 位元組隨機數 nT (例: 0x12345678) 並傳送",
    explanation: "卡片產生的隨機數 nT 用於後續的 Crypto-1 加密計算，確保每次驗證都不同",
    details: "隨機數 nT (Tag Nonce) 是 32 位元值，由卡片內部隨機數產生器產生。這是加密協定的基礎，防止重放攻擊。執行時間約 200μs。",
  },
  {
    id: 3,
    title: "讀卡機證明身份",
    description: "讀卡機使用金鑰加密卡片的隨機數，並附上自己的隨機數",
    phase: "讀卡機驗證",
    readerData: "用金鑰 A 加密 (nT+1) 產生 suc2(nT)，並附上隨機數 nR",
    cardData: "接收並驗證加密回應，檢查讀卡機是否知道正確金鑰",
    explanation: "如果讀卡機有正確金鑰，加密結果會符合卡片預期，驗證成功後卡片才會信任讀卡機",
    details: "suc2(nT) 是使用 Crypto-1 對 (nT+1) 進行加密的結果。讀卡機同時傳送隨機數 nR，供卡片後續驗證使用。執行時間約 300μs。",
  },
  {
    id: 4,
    title: "卡片驗證讀卡機",
    description: "卡片驗證讀卡機的回應並送回加密確認",
    phase: "相互驗證",
    readerData: "等待卡片的身份證明，確認這是合法卡片",
    cardData: "用金鑰 A 加密 (nR+1) 產生 suc3(nR)，證明自己也擁有金鑰",
    explanation: "這是相互驗證的核心，雙方都必須證明擁有相同的金鑰才能建立信任關係",
    details: "suc3(nR) 是卡片對讀卡機隨機數 nR 的加密回應。完成後雙方確認彼此擁有正確金鑰，可開始安全通訊。執行時間約 250μs。",
  },
  {
    id: 5,
    title: "建立加密通道",
    description: "驗證成功，使用共享金鑰建立加密的通訊通道",
    phase: "通道建立",
    readerData: "初始化 Crypto-1 加密狀態，準備進行加密的資料讀寫操作",
    cardData: "同步加密狀態，後續所有指令和回應都會經過 Crypto-1 加密",
    explanation: "現在可以安全地執行讀取餘額、扣款等操作，所有資料傳輸都受到 Crypto-1 保護",
    details: "Crypto-1 使用 48 位元金鑰和前面交換的隨機數來初始化 LFSR。加密狀態隨每個位元傳輸更新，提供串流加密。執行時間約 100μs。",
  },
];

const Crypto1Animation = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
      <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Lock size={20} className="text-yellow-400" />
        Crypto-1 演算法
      </h4>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">線性反饋移位暫存器 (LFSR)</span>
          <motion.div
            animate={{ rotate: isActive ? 360 : 0 }}
            transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
            className="w-8 h-8 border-2 border-yellow-400 rounded-full border-dashed"
          />
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {[...Array(48)].map((_, i) => (
            <motion.div
              key={i}
              className="h-2 bg-slate-600 rounded"
              animate={{
                backgroundColor: isActive 
                  ? ["#475569", "#fbbf24", "#475569"]
                  : "#475569"
              }}
              transition={{
                duration: 0.1,
                delay: i * 0.05,
                repeat: isActive ? Infinity : 0,
              }}
            />
          ))}
        </div>
        
        <div className="text-xs text-slate-400">
          48-bit 密鑰流產生器，使用多項式反饋進行加密
        </div>
      </div>
    </div>
  );
};

const KeyVisualization = () => {
  const [selectedKey, setSelectedKey] = useState<'A' | 'B'>('A');
  
  return (
    <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
      <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Key size={20} className="text-blue-400" />
        金鑰結構
      </h4>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedKey('A')}
            className={`px-3 py-1 rounded text-sm ${
              selectedKey === 'A' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            金鑰 A
          </button>
          <button
            onClick={() => setSelectedKey('B')}
            className={`px-3 py-1 rounded text-sm ${
              selectedKey === 'B' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            金鑰 B
          </button>
        </div>
        
        <div className="grid grid-cols-6 gap-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-8 rounded flex items-center justify-center text-xs font-mono ${
              selectedKey === 'A' ? 'bg-blue-600' : 'bg-purple-600'
            }`}>
              {selectedKey === 'A' ? 'A' : 'B'}{i}
            </div>
          ))}
        </div>
        
        <div className="text-xs text-slate-400">
          每個扇區有兩組 48-bit 金鑰，用於不同的存取權限控制
        </div>
        
        <div className={`p-3 rounded border-l-4 ${
          selectedKey === 'A' 
            ? 'border-blue-400 bg-blue-900/20' 
            : 'border-purple-400 bg-purple-900/20'
        }`}>
          <div className="text-sm font-medium">
            {selectedKey === 'A' ? '金鑰 A' : '金鑰 B'} 權限
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {selectedKey === 'A' 
              ? '通常用於讀取操作，權限較低'
              : '通常用於寫入操作，權限較高'
            }
          </div>
        </div>
      </div>
    </div>
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
            <Link href="/" className="text-green-400 hover:text-green-300 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Mifare Classic 加密驗證
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
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
          <div className="lg:col-span-2 space-y-6">
            {/* 驗證流程動畫 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="text-center">
                  <div className="w-24 h-32 bg-gradient-to-b from-green-500 to-green-700 rounded-lg mb-4 mx-auto shadow-lg relative">
                    <div className="w-full h-full flex items-center justify-center text-white font-bold">
                      讀卡機
                    </div>
                    <motion.div
                      animate={{ 
                        scale: currentStep >= 2 ? [1, 1.2, 1] : 1,
                        opacity: currentStep >= 2 ? [0.5, 1, 0.5] : 0.5 
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center"
                    >
                      <Key size={12} />
                    </motion.div>
                  </div>
                  <p className="text-sm text-slate-400">Reader</p>
                </div>

                {/* 加密通訊動畫 */}
                <div className="flex-1 mx-8 relative">
                  <div className="h-px bg-slate-600 w-full"></div>
                  
                  {/* 資料流動畫 */}
                  <AnimatePresence>
                    {currentStep < authSteps.length && (
                      <motion.div
                        key={`auth-step-${currentStep}`}
                        initial={{ x: currentStep % 2 === 0 ? -50 : 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: currentStep % 2 === 0 ? 50 : -50, opacity: 0 }}
                        className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded text-sm whitespace-nowrap ${
                          currentStep >= 2 ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                        }`}
                      >
                        {authSteps[currentStep]?.readerData}
                        {currentStep >= 2 && (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="inline-block ml-2"
                          >
                            🔒
                          </motion.div>
                        )}
                        <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${
                          currentStep >= 2 ? 'border-t-yellow-500' : 'border-t-green-500'
                        }`}></div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 安全通道指示 */}
                  <motion.div
                    animate={{
                      opacity: currentStep >= 4 ? [0.3, 0.8, 0.3] : 0,
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute -top-12 -bottom-12 left-0 right-0 border-2 border-dashed border-green-400 rounded-lg"
                  >
                    <span className="absolute -top-6 left-2 text-green-400 text-xs">
                      Encrypted Channel
                    </span>
                  </motion.div>
                </div>

                <div className="text-center">
                  <div className="w-20 h-28 bg-gradient-to-b from-purple-500 to-purple-700 rounded-lg mb-4 mx-auto shadow-lg relative">
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                      Mifare
                    </div>
                    <motion.div
                      animate={{ 
                        scale: currentStep >= 1 ? [1, 1.2, 1] : 1,
                        opacity: currentStep >= 1 ? [0.5, 1, 0.5] : 0.5 
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center"
                    >
                      <Shield size={12} />
                    </motion.div>
                  </div>
                  <p className="text-sm text-slate-400">Card</p>
                </div>
              </div>

              {/* 當前步驟資訊 */}
              <div className="text-center">
                <div className={`inline-block px-3 py-1 rounded-full text-sm mb-4 ${
                  authSteps[currentStep]?.phase === '初始化' ? 'bg-blue-900/50 text-blue-400' :
                  authSteps[currentStep]?.phase === '挑戰' ? 'bg-yellow-900/50 text-yellow-400' :
                  authSteps[currentStep]?.phase === '回應' ? 'bg-orange-900/50 text-orange-400' :
                  authSteps[currentStep]?.phase === '確認' ? 'bg-purple-900/50 text-purple-400' :
                  'bg-green-900/50 text-green-400'
                }`}>
                  {authSteps[currentStep]?.phase}
                </div>
                
                <h3 className="text-2xl font-bold mb-2">
                  步驟 {currentStep + 1}: {authSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-4">
                  {authSteps[currentStep]?.description}
                </p>
                
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-300">
                    {authSteps[currentStep]?.explanation}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Crypto-1 演算法視覺化 */}
            <Crypto1Animation isActive={isPlaying && currentStep >= 2} />

            {/* 進度條 */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">驗證進度</span>
                <span className="text-sm text-slate-400">
                  {currentStep + 1} / {authSteps.length}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / authSteps.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* 側邊欄 */}
          <div className="space-y-4">
            {/* 驗證步驟列表 */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ChevronRight size={20} />
                驗證步驟
              </h3>
              <div className="space-y-2">
                {authSteps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      index === currentStep
                        ? "bg-green-600 text-white"
                        : index < currentStep
                        ? "bg-emerald-900/30 text-emerald-400"
                        : "bg-slate-700/30 text-slate-400 hover:bg-slate-700/50"
                    }`}
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
                        <div className="text-xs opacity-75">{step.phase}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 金鑰結構視覺化 */}
            <KeyVisualization />

            {/* 安全性說明 */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield size={20} className="text-red-400" />
                安全性考量
              </h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="font-bold text-red-400 mb-1">已知弱點</div>
                  <div className="text-slate-300">
                    Crypto-1 演算法已被破解，金鑰可透過多種攻擊方式取得
                  </div>
                </div>
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="font-bold text-yellow-400 mb-1">改善建議</div>
                  <div className="text-slate-300">
                    建議升級至 Mifare DESFire 或其他更安全的 RFID 技術
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
