"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Play, Pause, RotateCcw } from "lucide-react";
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
    description: "讀卡機廣播 REQA 命令，尋找場域內的 Type A 卡片。對應 Proxmark3 中的 iso14443a_select_card() 函數",
    data: "REQA: 0x26",
    dataDirection: 'reader-to-card',
    details: "REQA (REQuest Type A) 是 ISO 14443-3 定義的喚醒命令。使用 Modified Miller 編碼，僅 7 位元，不含 CRC。在 Proxmark3 中，WUPA_POLLING_PARAMETERS 或 REQA_POLLING_PARAMETERS 控制此命令的發送時序。只有處於 IDLE 狀態的 Type A 卡片會回應此命令。",
  },
  {
    id: 3,
    title: "ATQA 回應",
    description: "卡片回應 ATQA，告知讀卡機自身的基本特性。Proxmark3 解析此數據判斷 UID 長度和卡片類型",
    data: "ATQA: 0x0004",
    dataDirection: 'card-to-reader',
    details: "ATQA (Answer To request Type A) 包含關鍵信息：bit 6-8 指示 UID 長度（00=4 bytes），bit 0-4 指示 Bit Frame Anticollision 支援。0x0004 表示 4-byte UID 且支援 ISO 14443-4。在 Proxmark3 中，iso14a_card_select_t 結構體存儲此信息用於後續處理。使用 Manchester 編碼傳輸。",
  },
  {
    id: 4,
    title: "防碰撞初始化",
    description: "讀卡機啟動防碰撞程序，對應 Proxmark3 的 cascade level 處理邏輯",
    data: "SELECT: 0x93 0x20",
    dataDirection: 'reader-to-card',
    details: "SELECT 命令啟動 Cascade Level 1 的防碰撞程序。0x93 表示 SEL_CL1，0x20 表示 NVB (Number of Valid Bits) = 2 bytes。Proxmark3 在 iso14443a_select_card() 中會根據 ATQA 決定需要多少個 cascade levels（4-byte UID 需要 1 個，7-byte 需要 2 個，10-byte 需要 3 個）。",
  },
  {
    id: 5,
    title: "UID 傳輸與碰撞檢測",
    description: "所有卡片同時傳送 UID，讀卡機使用 Proxmark3 的碰撞檢測算法進行處理",
    data: "UID: 4 bytes + BCC",
    dataDirection: 'card-to-reader',
    details: "多張卡片同時回應時會在 UID 不同的位置產生碰撞。Proxmark3 通過檢測波形異常來識別碰撞位置，然後逐步指定該位的值 (0 或 1)，只有符合的卡片繼續回應。BCC (Block Check Character) = UID[0]⊕UID[1]⊕UID[2]⊕UID[3]，Proxmark3 會驗證此校驗位的正確性。",
  },
  {
    id: 6,
    title: "卡片選取",
    description: "讀卡機選取特定卡片，在 Proxmark3 中通過 iso14443a_fast_select_card() 實現",
    data: "SELECT: 0x93 0x70 + UID + CRC",
    dataDirection: 'reader-to-card',
    details: "SELECT 命令包含 NVB=0x70 (表示傳送完整的 40 位 UID+BCC)、4-byte UID 和 2-byte CRC-A。Proxmark3 會計算並附加 CRC-A 校驗碼，只有 UID 完全匹配且 CRC 正確的卡片會進入 ACTIVE 狀態並回應。此時 CUID (Card UID) 被確定並存儲。",
  },
  {
    id: 7,
    title: "SAK 確認",
    description: "被選中的卡片回應 SAK，Proxmark3 根據 SAK 值識別具體的卡片類型和能力",
    data: "SAK: 0x08",
    dataDirection: 'card-to-reader',
    details: "SAK (Select AcKnowledge) 的各位有特定含義：bit 2=0 表示 UID 完整，bit 3=0 表示非 ISO 14443-4 相容（MIFARE Classic）。SAK=0x08 特指 MIFARE Classic 1K，0x18 為 4K，0x88 為 Plus。Proxmark3 的 GetHF14AMfU_Type() 函數根據 SAK 值精確識別卡片型號。卡片現在處於 ACTIVE 狀態，可接受 MIFARE 特定命令如認證 (0x60/0x61)。",
  },
  {
    id: 8,
    title: "MIFARE Classic 認證",
    description: "使用 Crypto-1 算法進行扇區認證，對應 Proxmark3 的 mf_auth() 函數實作",
    data: "AUTH: 0x60 + Block + Key A",
    dataDirection: 'reader-to-card',
    details: "認證命令格式：0x60 (Key A) 或 0x61 (Key B) + Block Number + CRC-A。Proxmark3 在 mifarecmd.c 中實作，使用 4-byte 隨機數 nT 和 4-byte nR 進行三次握手。Crypto-1 LFSR 狀態由卡片 UID、Key 和兩個隨機數確定。此時讀卡機和卡片共同計算 {aR} = ks1 ⊕ aR，建立加密通道。",
  },
  {
    id: 9,
    title: "隨機數交換與密鑰驗證",
    description: "雙方交換隨機數並驗證密鑰，Proxmark3 通過 crypto1_word() 實作位元流加密",
    data: "nT ↔ {nR, aR} ↔ {aT}",
    dataDirection: 'both',
    details: "卡片先發送 32-bit 明文隨機數 nT。讀卡機計算 Crypto-1 密鑰流，發送加密的 {nR, aR}，其中 nR 是 32-bit 隨機數，aR=suc2(nT) 是認證回應。卡片驗證 aR 正確性後發送 {aT=suc3(nT)}。Proxmark3 的 crypto1_create() 函數使用 48-bit 密鑰初始化 LFSR，整個過程在 ARM 韌體 mifarecmd.c 中約 200 行程式碼實作。",
  },
  {
    id: 10,
    title: "加密通道建立",
    description: "認證成功後，所有後續通訊都使用 Crypto-1 加密，Proxmark3 維護 LFSR 狀態",
    data: "Encrypted Channel Established",
    dataDirection: 'both',
    details: "認證成功後，Crypto-1 密鑰流生成器進入工作狀態。每個位元都通過 ks=lfsr_rollback_bit(s,in,fb) 計算，其中 s 是 48-bit LFSR 狀態。Proxmark3 中的 crypto1_bit() 函數處理逐位元加解密。此時可執行讀取 (0x30)、寫入 (0xA0)、增值 (0xC0) 等命令。LFSR 狀態必須與卡片同步，任何通訊錯誤都需要重新認證。",
  },
  {
    id: 11,
    title: "資料讀取操作",
    description: "對已認證的塊進行讀取，Proxmark3 使用 iso14443a_fast_select_card() 最佳化連續操作",
    data: "READ: 0x30 + Block",
    dataDirection: 'reader-to-card',
    details: "讀取命令由 0x30 + Block Number (1 byte) + CRC-A 組成。卡片回應 16 bytes 資料 + 2 bytes CRC-A，全部經過 Crypto-1 加密。Proxmark3 的 MifareReadBlock() 函數實作此功能，支援 pipeline 模式以提高效率。讀取會檢查存取控制位元 (Access bits)，確認當前密鑰是否有讀取權限。錯誤的權限設定會導致認證失效並需要重新開始。",
  },
  {
    id: 12,
    title: "通訊結束",
    description: "關閉射頻場域或切換到其他卡片，Proxmark3 使用 FpgaWriteConfWord() 控制",
    data: "RF Field OFF",
    dataDirection: 'none',
    details: "讀卡機關閉 13.56 MHz 載波，所有卡片返回 POWER-OFF 狀態。在 Proxmark3 中，FpgaWriteConfWord(FPGA_MAJOR_MODE_OFF) 關閉 RF 場域。替代方法是發送 HLTA (0x50 0x00 + CRC) 命令讓卡片進入 HALT 狀態，此時卡片只對 WUPA (0x52) 回應，不回應 REQA。場域關閉至少 5ms 後重新開啟，所有卡片會重新進入 IDLE 狀態等待下次選取過程。",
  }
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
              <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0">
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
              </Link>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl lg:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Mifare Classic 通訊協定
            </h1>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <motion.button
              onClick={togglePlayPause}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg text-base sm:text-lg lg:text-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying ? <Pause size={16} className="sm:w-5 sm:h-5" /> : <Play size={16} className="sm:w-5 sm:h-5" />}
              {isPlaying ? "暫停" : "播放"}
            </motion.button>
            <motion.button
              onClick={resetAnimation}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors shadow-lg text-base sm:text-lg lg:text-xl"
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
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6"
            >
              {/* 當前步驟標題 */}
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2">
                  步驟 {currentStep + 1}: {communicationSteps[currentStep]?.title}
                </h3>
                <p className="text-slate-300 mb-4 sm:mb-6 text-sm sm:text-base leading-relaxed">
                  {communicationSteps[currentStep]?.description}
                </p>
              </div>

              {/* 統一的通訊動畫區域 */}
              <div className="bg-slate-900/50 border border-slate-600/30 rounded-lg p-4 sm:p-8 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
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
                      className="w-16 h-20 sm:w-24 sm:h-32 bg-gradient-to-b from-blue-500 to-blue-700 rounded-lg mb-2 sm:mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-lg sm:text-2xl">📡</span>
                    </motion.div>
                    <p className="text-xs sm:text-sm text-slate-400">讀卡機 (Reader)</p>
                  </div>

                  {/* 資料傳輸動畫區域 */}
                  <div className="flex-1 mx-4 sm:mx-8 relative h-12 sm:h-20 flex items-center">
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
                      <span className="absolute -top-4 sm:-top-6 left-1 sm:left-2 text-yellow-400 text-xs">
                        RF Field (13.56 MHz)
                      </span>
                    </motion.div>
                    
                    {/* 資料封包動畫 */}
                    <AnimatePresence>
                      {communicationSteps[currentStep]?.data && communicationSteps[currentStep]?.dataDirection !== 'none' && (
                        <motion.div
                          key={`data-${currentStep}`}
                          initial={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? -60 : 60,
                            opacity: 0 
                          }}
                          animate={{ 
                            x: communicationSteps[currentStep]?.dataDirection === 'reader-to-card' ? 60 : -60,
                            opacity: [0, 1, 1, 0] 
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="absolute bg-blue-500 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-mono whitespace-nowrap top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
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
                        className="text-xl sm:text-3xl text-white"
                      >
                        {communicationSteps[currentStep]?.dataDirection === 'reader-to-card' && '→'}
                        {communicationSteps[currentStep]?.dataDirection === 'card-to-reader' && '←'}
                        {communicationSteps[currentStep]?.dataDirection === 'both' && '↔'}
                        {communicationSteps[currentStep]?.dataDirection === 'none' && '⚡'}
                      </motion.div>
                    </div>
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
                      className="w-16 h-20 sm:w-20 sm:h-28 bg-gradient-to-b from-purple-500 to-purple-700 rounded-lg mb-2 sm:mb-4 mx-auto shadow-lg flex items-center justify-center"
                    >
                      <span className="text-white text-lg sm:text-2xl">💳</span>
                    </motion.div>
                    <p className="text-xs sm:text-sm text-slate-400">卡片 (Mifare)</p>
                  </div>
                </div>

                {/* 流向與資料說明 */}
                <div className="text-center">
                  <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-slate-800/50 rounded-lg px-3 sm:px-4 py-2">
                    <span className="text-slate-400 text-xs sm:text-sm">資料流向：</span>
                    <span className="text-yellow-400 font-mono font-bold text-xs sm:text-sm">
                      {communicationSteps[currentStep]?.dataDirection === 'reader-to-card' && '📡 讀卡機 → 卡片 💳'}
                      {communicationSteps[currentStep]?.dataDirection === 'card-to-reader' && '💳 卡片 → 讀卡機 📡'}
                      {communicationSteps[currentStep]?.dataDirection === 'both' && '📡 ↔ 💳 雙向通訊'}
                      {communicationSteps[currentStep]?.dataDirection === 'none' && '⚡ 電力場域建立'}
                    </span>
                    {communicationSteps[currentStep]?.data && (
                      <>
                        <span className="text-slate-400 text-xs sm:text-sm">資料：</span>
                        <span className="text-blue-400 font-mono font-bold text-xs sm:text-sm">
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
                className="bg-slate-900/30 border border-blue-500/20 rounded-lg p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-cyan-400 flex items-center gap-2">
                  <span className="text-lg sm:text-xl">📡</span>
                  通訊原理
                </h3>
                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
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
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  <ArrowLeft size={16} />
                  上一步
                </button>
                
                <div className="text-center px-4">
                  <div className="text-sm font-medium text-white">
                    步驟 {currentStep + 1} / {communicationSteps.length}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {communicationSteps[currentStep]?.title}
                  </div>
                </div>
                
                <button
                  onClick={() => goToStep(Math.min(communicationSteps.length - 1, currentStep + 1))}
                  disabled={currentStep === communicationSteps.length - 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                    currentStep === communicationSteps.length - 1
                      ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  下一步
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 - 只在大螢幕顯示 */}
          <div className="hidden lg:block space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* 步驟導航 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 lg:max-h-[calc(100vh-12rem)] flex flex-col"
            >
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 flex-shrink-0">
                <span className="text-blue-400">📡</span>
                通訊步驟
              </h3>
              <div className="flex lg:flex-col gap-2 lg:gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto flex-1 lg:pr-2 pb-2 lg:pb-0 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                {communicationSteps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={`flex-shrink-0 lg:w-full text-left p-2 sm:p-3 rounded-lg transition-all duration-300 min-w-[180px] lg:min-w-0 min-h-[44px] ${
                      index === currentStep
                        ? "bg-blue-600/30 border border-blue-500/50 text-white shadow-lg"
                        : index < currentStep
                        ? "bg-cyan-900/30 text-cyan-400"
                        : "bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === currentStep
                          ? "bg-blue-500 text-white"
                          : index < currentStep
                          ? "bg-cyan-500 text-white"
                          : "bg-slate-600 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{step.title}</p>
                        <p className="text-xs opacity-75 hidden lg:block truncate">ISO 14443-3 協定</p>
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
