"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Folder, Lock, Wifi, HardDrive, CheckCircle, Shield, Target } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const sections = [
    {
      title: "通訊協定",
      description: "RFID 通訊流程與協定分析",
      icon: Wifi,
      href: "/communication",
      color: "from-blue-500 to-blue-700",
      type: "demo",
      status: "available",
      features: ["RF 場域建立", "REQA/ATQA 交換", "防碰撞程序", "UID 識別"],
    },
    {
      title: "安全機制",
      description: "Crypto-1 加密與身份驗證",
      icon: Lock,
      href: "/authentication", 
      color: "from-green-500 to-green-700",
      type: "demo",
      status: "available",
      features: ["相互驗證", "Crypto-1 演算法", "金鑰管理", "安全通道"],
    },
    {
      title: "記憶體結構",
      description: "資料組織與記憶體管理",
      icon: HardDrive,
      href: "/memory",
      color: "from-purple-500 to-purple-700", 
      type: "demo",
      status: "available",
      features: ["Hex 編輯器", "扇區結構", "存取控制", "資料格式"],
    },
    {
      title: "Nested Attack",
      description: "利用認證漏洞的金鑰恢復攻擊",
      icon: Shield,
      href: "/nested",
      color: "from-red-500 to-red-700",
      type: "attack",
      status: "available", 
      features: ["認證序列分析", "nT 預測", "金鑰空間縮減", "暴力破解"],
    },
    {
      title: "Darkside Attack",
      description: "基於錯誤注入的快速金鑰破解",
      icon: Target,
      href: "/darkside",
      color: "from-orange-500 to-orange-700",
      type: "attack",
      status: "available",
      features: ["錯誤注入", "Parity 分析", "金鑰位恢復", "快速破解"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* 檔案瀏覽器風格的頭部 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-t-xl p-4 mb-0"
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Folder size={16} />
              <span className="text-sm">Mifare Classic 視覺化展示</span>
            </div>
          </div>
        </motion.div>

        {/* 主要內容區域 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 border-t-0 rounded-b-xl p-8"
        >
          {/* 路徑導航 */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
            <BookOpen size={16} />
            <span>展示首頁</span>
            <ArrowRight size={14} />
            <span>視覺化模組</span>
          </div>

          {/* 視覺化模組網格 - 檔案瀏覽器風格 */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-200 mb-6">選擇展示模組</h2>
            
            <div className="grid gap-4">
              {sections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Link href={section.href}>
                    <div className="group flex items-center gap-4 p-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500 rounded-lg transition-all duration-300 cursor-pointer">
                      {/* 檔案圖標區域 */}
                      <div className="relative">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${section.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                          <section.icon size={24} className="text-white" />
                        </div>
                        {/* 演示狀態指示 */}
                        <div className="absolute -top-1 -right-1">
                          <CheckCircle size={16} className="text-green-400 bg-slate-800 rounded-full" />
                        </div>
                      </div>

                      {/* 檔案資訊 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">
                            {section.title}
                          </h3>
                          <span className="px-2 py-1 text-xs rounded-full bg-slate-600/50 text-slate-300">
                            互動展示
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-2">{section.description}</p>
                        
                        {/* 檔案標籤 */}
                        <div className="flex gap-2">
                          {section.features.slice(0, 3).map((feature, idx) => (
                            <span key={idx} className="text-xs bg-slate-600/50 text-slate-300 px-2 py-1 rounded">
                              {feature}
                            </span>
                          ))}
                          {section.features.length > 3 && (
                            <span className="text-xs text-slate-500">+{section.features.length - 3} more</span>
                          )}
                        </div>
                      </div>

                      {/* 進入箭頭 */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={20} className="text-slate-400" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* 統計資訊 - 檔案瀏覽器底部狀態列風格 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 pt-6 border-t border-slate-600/50"
            >
              <div className="flex justify-between items-center text-sm text-slate-400">
                <div className="flex gap-6">
                  <span>5 個展示模組</span>
                  <span>類型: 互動視覺化</span>
                </div>
                <div className="flex gap-4">
                  <span>13.56 MHz</span>
                  <span>1024 bytes</span>
                  <span>Crypto-1</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 底部提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-slate-500 text-sm">
            點擊模組卡片開始視覺化展示 • 互動式原理演示
          </p>
        </motion.div>
      </div>
    </div>
  );
}
