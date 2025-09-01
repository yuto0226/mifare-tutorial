"use client";

import { motion } from "framer-motion";
import { ArrowRight, Radio, Shield, Database, BookOpen } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const sections = [
    {
      title: "通訊過程",
      description: "了解 Mifare Classic 卡片與讀卡機之間的通訊流程",
      icon: Radio,
      href: "/communication",
      color: "from-blue-500 to-blue-700",
      features: ["RF 場域建立", "REQA/ATQA 交換", "防碰撞程序", "UID 識別"],
    },
    {
      title: "加密驗證",
      description: "深入探討 Crypto-1 加密演算法和驗證機制",
      icon: Shield,
      href: "/authentication",
      color: "from-green-500 to-green-700",
      features: ["相互驗證", "Crypto-1 演算法", "金鑰管理", "安全通道"],
    },
    {
      title: "記憶體分布",
      description: "視覺化呈現 Mifare Classic 的記憶體結構和資料分配",
      icon: Database,
      href: "/memory",
      color: "from-purple-500 to-purple-700",
      features: ["Hex 編輯器", "扇區結構", "存取控制", "資料格式"],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
  };

  const statsVariants = {
    hidden: { scale: 0 },
    visible: {
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        delay: 0.8,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
          >
            <BookOpen size={40} className="text-white" />
          </motion.div>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Mifare Classic 教學
          </h1>
          <p className="text-xl text-slate-300 max-w-4xl mx-auto leading-relaxed">
            透過互動式視覺化方式，深入了解 Mifare Classic RFID 卡的運作原理。
            從基本通訊協定到進階安全機制，從記憶體結構到實際應用，
            讓您全面掌握這項廣泛應用的近場通訊技術。
          </p>
        </motion.div>

        {/* 統計數據 */}
        <motion.div
          variants={statsVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-4 gap-6 mb-16"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-400 mb-2">13.56</div>
            <div className="text-slate-400">MHz 頻率</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400 mb-2">1024</div>
            <div className="text-slate-400">Bytes 容量</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">16</div>
            <div className="text-slate-400">扇區數量</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-pink-400 mb-2">10</div>
            <div className="text-slate-400">cm 通訊距離</div>
          </div>
        </motion.div>

        {/* 學習模組卡片 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto mb-16"
        >
          {sections.map((section, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Link href={section.href}>
                <div className="group relative overflow-hidden rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-all duration-300 hover:scale-105 hover:shadow-2xl h-full">
                  <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                  
                  <div className="p-8 relative z-10 h-full flex flex-col">
                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${section.color} mb-6 w-fit`}>
                      <section.icon size={32} className="text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-blue-400 transition-colors">
                      {section.title}
                    </h3>
                    
                    <p className="text-slate-400 mb-6 leading-relaxed flex-grow">
                      {section.description}
                    </p>
                    
                    {/* 特色功能列表 */}
                    <div className="mb-6">
                      <div className="text-sm font-medium text-slate-300 mb-3">主要功能：</div>
                      <div className="grid grid-cols-2 gap-2">
                        {section.features.map((feature, featureIndex) => (
                          <div
                            key={featureIndex}
                            className="text-xs text-slate-400 bg-slate-700/30 px-2 py-1 rounded"
                          >
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center text-blue-400 group-hover:text-blue-300 transition-colors mt-auto">
                      <span className="font-medium">開始學習</span>
                      <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* 快速導航 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold mb-8 text-slate-200">學習路徑建議</h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            <div className="flex items-center bg-slate-800/50 rounded-full px-6 py-3 border border-slate-700">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">1</div>
              <span className="text-slate-300">了解通訊過程</span>
            </div>
            <ArrowRight className="text-slate-600 mt-3" size={20} />
            <div className="flex items-center bg-slate-800/50 rounded-full px-6 py-3 border border-slate-700">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">2</div>
              <span className="text-slate-300">學習加密驗證</span>
            </div>
            <ArrowRight className="text-slate-600 mt-3" size={20} />
            <div className="flex items-center bg-slate-800/50 rounded-full px-6 py-3 border border-slate-700">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">3</div>
              <span className="text-slate-300">探索記憶體結構</span>
            </div>
          </div>
        </motion.div>

        {/* 技術規格 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 max-w-4xl mx-auto"
        >
          <h3 className="text-2xl font-bold mb-6 text-center">技術規格一覽</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-blue-400 mb-4">物理特性</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">工作頻率</span>
                  <span>13.56 MHz</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">通訊距離</span>
                  <span>最大 10 cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">資料傳輸率</span>
                  <span>106 kbit/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">調變方式</span>
                  <span>ASK</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-green-400 mb-4">記憶體結構</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">總容量</span>
                  <span>1024 bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">扇區數量</span>
                  <span>16 個扇區</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">每扇區區塊</span>
                  <span>4 個區塊</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">加密演算法</span>
                  <span>Crypto-1</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="text-center mt-16"
        >
          <p className="text-slate-500 mb-4">
            點擊上方卡片開始探索 Mifare Classic 的奧秘
          </p>
          <div className="text-xs text-slate-600">
            本教學網站使用互動式動畫和視覺化技術，讓複雜的 RFID 概念變得易於理解
          </div>
        </motion.div>
      </div>
    </div>
  );
}
