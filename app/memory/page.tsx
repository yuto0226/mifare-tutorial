"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Info, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface MemoryBlock {
  sector: number;
  block: number;
  address: number;
  data: string;
  type: 'manufacturer' | 'data' | 'value' | 'trailer';
  description: string;
  keyA?: string;
  accessBits?: string;
  keyB?: string;
}

// Mifare Classic 1K 記憶體結構
const memoryData: MemoryBlock[] = [
  // Sector 0
  { sector: 0, block: 0, address: 0x00, data: "12345678901234567890123456789012", type: 'manufacturer', description: "製造商資料 (UID + BCC + SAK + ATQA + 製造商資料)" },
  { sector: 0, block: 1, address: 0x01, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 1" },
  { sector: 0, block: 2, address: 0x02, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 2" },
  { sector: 0, block: 3, address: 0x03, data: "FFFFFFFFFFFF078069FFFFFFFFFFFF", type: 'trailer', description: "扇區尾塊 (金鑰 A + 存取位元 + 金鑰 B)", keyA: "FFFFFFFFFFFF", accessBits: "078069", keyB: "FFFFFFFFFFFF" },
  
  // Sector 1
  { sector: 1, block: 4, address: 0x04, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 4" },
  { sector: 1, block: 5, address: 0x05, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 5" },
  { sector: 1, block: 6, address: 0x06, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 6" },
  { sector: 1, block: 7, address: 0x07, data: "FFFFFFFFFFFF078069FFFFFFFFFFFF", type: 'trailer', description: "扇區尾塊 (金鑰 A + 存取位元 + 金鑰 B)", keyA: "FFFFFFFFFFFF", accessBits: "078069", keyB: "FFFFFFFFFFFF" },
  
  // Value block example (Sector 2)
  { sector: 2, block: 8, address: 0x08, data: "64000000FFFF9BFFFF64000000041EFB", type: 'value', description: "值區塊 (Value: 100, Backup, ~Value, Backup, Address, ~Address, Address, ~Address)" },
  { sector: 2, block: 9, address: 0x09, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 9" },
  { sector: 2, block: 10, address: 0x0A, data: "00000000000000000000000000000000", type: 'data', description: "資料區塊 10" },
  { sector: 2, block: 11, address: 0x0B, data: "FFFFFFFFFFFF078069FFFFFFFFFFFF", type: 'trailer', description: "扇區尾塊 (金鑰 A + 存取位元 + 金鑰 B)", keyA: "FFFFFFFFFFFF", accessBits: "078069", keyB: "FFFFFFFFFFFF" },
];

// 為剩餘扇區生成資料 (Sector 3-15)
for (let sector = 3; sector < 16; sector++) {
  for (let blockInSector = 0; blockInSector < 4; blockInSector++) {
    const block = sector * 4 + blockInSector;
    const isTrailer = blockInSector === 3;
    
    memoryData.push({
      sector,
      block,
      address: block,
      data: isTrailer ? "FFFFFFFFFFFF078069FFFFFFFFFFFF" : "00000000000000000000000000000000",
      type: isTrailer ? 'trailer' : 'data',
      description: isTrailer 
        ? `扇區 ${sector} 尾塊 (金鑰 A + 存取位元 + 金鑰 B)`
        : `扇區 ${sector} 資料區塊 ${block}`,
      ...(isTrailer && {
        keyA: "FFFFFFFFFFFF",
        accessBits: "078069", 
        keyB: "FFFFFFFFFFFF"
      })
    });
  }
}

const getBlockColor = (type: string) => {
  switch (type) {
    case 'manufacturer': return 'bg-blue-600';
    case 'data': return 'bg-slate-600';
    case 'value': return 'bg-green-600';
    case 'trailer': return 'bg-red-600';
    default: return 'bg-slate-600';
  }
};

const getBlockBorderColor = (type: string) => {
  switch (type) {
    case 'manufacturer': return 'border-blue-400';
    case 'data': return 'border-slate-400';
    case 'value': return 'border-green-400';
    case 'trailer': return 'border-red-400';
    default: return 'border-slate-400';
  }
};

const HexEditor = ({ 
  data, 
  selectedBlock, 
  onBlockSelect,
  showKeys 
}: { 
  data: MemoryBlock[]; 
  selectedBlock: number | null;
  onBlockSelect: (block: number) => void;
  showKeys: boolean;
}) => {
  return (
    <div className="bg-slate-900/80 rounded-lg p-4 font-mono text-sm">
      <div className="grid grid-cols-16 gap-1 mb-4">
        {/* Header */}
        <div className="text-slate-400 text-xs">Addr</div>
        {[...Array(16)].map((_, i) => (
          <div key={i} className="text-slate-400 text-xs text-center">
            {i.toString(16).toUpperCase()}
          </div>
        ))}
      </div>
      
      {data.map((block, blockIndex) => {
        const isSelected = selectedBlock === blockIndex;
        const isTrailer = block.type === 'trailer';
        
        // 處理 trailer block 的敏感資料顯示
        let displayData = block.data;
        if (isTrailer && !showKeys) {
          // 隱藏金鑰部分，只顯示存取位元
          displayData = "××××××××××××" + block.data.substring(12, 18) + "××××××××××××";
        }
        const displayBytes = displayData.match(/.{2}/g) || [];
        
        return (
          <motion.div
            key={blockIndex}
            className="grid grid-cols-16 gap-1 mb-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: blockIndex * 0.02 }}
          >
            {/* Address */}
            <div className="text-slate-400 text-xs flex items-center">
              {block.address.toString(16).toUpperCase().padStart(2, '0')}
            </div>
            
            {/* Data bytes */}
            {[...Array(16)].map((_, byteIndex) => {
              const byte = displayBytes[byteIndex] || '00';
              const isKeyByte = isTrailer && !showKeys && (byteIndex < 6 || byteIndex >= 10);
              
              return (
                <motion.button
                  key={byteIndex}
                  onClick={() => onBlockSelect(blockIndex)}
                  className={`
                    h-6 text-xs flex items-center justify-center rounded transition-all
                    ${isSelected 
                      ? `${getBlockColor(block.type)} text-white border-2 ${getBlockBorderColor(block.type)}` 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                    }
                    ${isKeyByte ? 'text-red-400' : ''}
                  `}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {byte}
                </motion.button>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
};

const BlockDetails = ({ 
  block, 
  showKeys 
}: { 
  block: MemoryBlock | null;
  showKeys: boolean;
}) => {
  if (!block) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-6 text-center text-slate-400">
        選擇一個記憶體區塊查看詳細資訊
      </div>
    );
  }

  return (
    <motion.div
      key={block.block}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-lg p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded ${getBlockColor(block.type)}`}></div>
        <h3 className="text-xl font-bold">
          區塊 {block.block} (0x{block.address.toString(16).toUpperCase().padStart(2, '0')})
        </h3>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-bold text-slate-300 mb-2">基本資訊</h4>
          <div className="space-y-1 text-sm">
            <div>扇區: {block.sector}</div>
            <div>類型: {
              block.type === 'manufacturer' ? '製造商資料' :
              block.type === 'data' ? '資料區塊' :
              block.type === 'value' ? '值區塊' :
              '扇區尾塊'
            }</div>
            <div>地址: 0x{block.address.toString(16).toUpperCase().padStart(2, '0')}</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-300 mb-2">描述</h4>
          <p className="text-sm text-slate-400">{block.description}</p>
        </div>
      </div>

      {/* 原始資料 */}
      <div>
        <h4 className="font-bold text-slate-300 mb-2">原始資料</h4>
        <div className="bg-slate-900 p-3 rounded font-mono text-sm break-all">
          {block.data}
        </div>
      </div>

      {/* 特殊區塊詳細資訊 */}
      {block.type === 'trailer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-2">扇區尾塊結構</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-red-900/30 p-3 rounded">
              <div className="font-bold text-red-400 mb-1">金鑰 A</div>
              <div className="font-mono">
                {showKeys ? block.keyA : '××××××××××××'}
              </div>
            </div>
            <div className="bg-yellow-900/30 p-3 rounded">
              <div className="font-bold text-yellow-400 mb-1">存取位元</div>
              <div className="font-mono">{block.accessBits}</div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded">
              <div className="font-bold text-purple-400 mb-1">金鑰 B</div>
              <div className="font-mono">
                {showKeys ? block.keyB : '××××××××××××'}
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'value' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-2">值區塊結構</h4>
          <div className="bg-green-900/30 p-3 rounded text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-bold text-green-400 mb-1">數值</div>
                <div className="font-mono">100 (0x64)</div>
              </div>
              <div>
                <div className="font-bold text-green-400 mb-1">備份與反轉</div>
                <div className="font-mono text-xs">值的備份與二進制反轉確保資料完整性</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'manufacturer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-2">製造商資料結構</h4>
          <div className="space-y-2 text-sm">
            <div className="bg-blue-900/30 p-3 rounded">
              <div className="font-bold text-blue-400 mb-1">UID (前4位元組)</div>
              <div className="font-mono">12 34 56 78</div>
            </div>
            <div className="bg-blue-900/30 p-3 rounded">
              <div className="font-bold text-blue-400 mb-1">BCC + SAK + ATQA + 製造商資料</div>
              <div className="font-mono text-xs">區塊檢查字元、選取確認、答詢回應、製造商特定資料</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const MemoryMap = ({ 
  onSectorSelect, 
  selectedSector 
}: { 
  onSectorSelect: (sector: number) => void;
  selectedSector: number | null;
}) => {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <h4 className="font-bold mb-4">記憶體配置圖</h4>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(16)].map((_, sector) => (
          <motion.button
            key={sector}
            onClick={() => onSectorSelect(sector)}
            className={`
              p-3 rounded text-sm font-medium transition-all
              ${selectedSector === sector 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div>扇區 {sector}</div>
            <div className="text-xs opacity-75">
              {sector === 0 ? '製造商' : '資料'}
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="mt-4 text-xs text-slate-400">
        總容量: 1024 bytes (16 扇區 × 4 區塊 × 16 位元組)
      </div>
    </div>
  );
};

export default function MemoryPage() {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [selectedSector, setSelectedSector] = useState<number | null>(0);
  const [showKeys, setShowKeys] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = memoryData.filter(block => 
    searchTerm === "" || 
    block.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.data.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.sector.toString().includes(searchTerm)
  );

  const handleSectorSelect = (sector: number) => {
    setSelectedSector(sector);
    // 自動選擇該扇區的第一個區塊
    const firstBlockInSector = memoryData.findIndex(block => block.sector === sector);
    if (firstBlockInSector !== -1) {
      setSelectedBlock(firstBlockInSector);
    }
  };

  const selectedBlockData = selectedBlock !== null ? filteredData[selectedBlock] : null;

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
            <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mifare Classic 記憶體分布
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 搜尋框 */}
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋區塊或資料..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            {/* 顯示/隱藏金鑰 */}
            <button
              onClick={() => setShowKeys(!showKeys)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showKeys 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              {showKeys ? <EyeOff size={20} /> : <Eye size={20} />}
              {showKeys ? '隱藏金鑰' : '顯示金鑰'}
            </button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Hex Editor */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">十六進制編輯器視圖</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded"></div>
                    <span>製造商</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-600 rounded"></div>
                    <span>資料</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-600 rounded"></div>
                    <span>值區塊</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded"></div>
                    <span>扇區尾</span>
                  </div>
                </div>
              </div>
              
              <HexEditor 
                data={filteredData}
                selectedBlock={selectedBlock}
                onBlockSelect={setSelectedBlock}
                showKeys={showKeys}
              />
            </motion.div>

            {/* 統計資訊 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid md:grid-cols-4 gap-4"
            >
              <div className="bg-blue-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-400">1</div>
                <div className="text-sm text-slate-400">製造商區塊</div>
              </div>
              <div className="bg-slate-700/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-slate-400">47</div>
                <div className="text-sm text-slate-400">資料區塊</div>
              </div>
              <div className="bg-green-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-400">1</div>
                <div className="text-sm text-slate-400">值區塊</div>
              </div>
              <div className="bg-red-900/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-400">16</div>
                <div className="text-sm text-slate-400">扇區尾塊</div>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 */}
          <div className="space-y-6">
            {/* 記憶體配置圖 */}
            <MemoryMap 
              onSectorSelect={handleSectorSelect}
              selectedSector={selectedSector}
            />

            {/* 區塊詳細資訊 */}
            <BlockDetails 
              block={selectedBlockData}
              showKeys={showKeys}
            />

            {/* 存取控制說明 */}
            <div className="bg-slate-800/50 rounded-lg p-6">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Info size={20} className="text-blue-400" />
                存取控制
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-bold text-yellow-400 mb-1">存取位元</div>
                  <div className="text-slate-400">
                    控制每個區塊的讀寫權限，位於扇區尾塊的第 6-8 位元組
                  </div>
                </div>
                <div>
                  <div className="font-bold text-red-400 mb-1">金鑰權限</div>
                  <div className="text-slate-400">
                    金鑰 A 通常用於讀取，金鑰 B 用於寫入操作
                  </div>
                </div>
                <div>
                  <div className="font-bold text-purple-400 mb-1">預設值</div>
                  <div className="text-slate-400">
                    出廠預設金鑰為 FFFFFFFFFFFF，存取位元為 078069
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
