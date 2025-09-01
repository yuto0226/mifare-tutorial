'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Info } from 'lucide-react';

interface MemoryBlock {
  block: number;
  sector: number;
  address: number;
  data: string;
  type: 'manufacturer' | 'data' | 'value' | 'trailer';
  description: string;
  keyA?: string;
  keyB?: string;
  accessBits?: string;
  valueInfo?: {
    value: number;
    valueInverted: number;
    valueBackup: number;
    addr: number;
    addrInverted: number;
    addrBackup: number;
    addrInvertedBackup: number;
    isValid: boolean;
    validationErrors: {
      valueInverted: boolean;
      valueBackup: boolean;
      addrInverted: boolean;
      addrBackup: boolean;
    };
  };
}

// 解析 Value Block 格式
const parseValueBlock = (data: string) => {
  if (data.length !== 32) return null;
  
  // 將十六進制字符串轉換為字節數組
  const bytes = data.match(/.{2}/g)?.map(hex => parseInt(hex, 16)) || [];
  if (bytes.length !== 16) return null;
  
  // 讀取 4 字節的值 (Little Endian) - 確保使用無符號 32 位元
  const value = ((bytes[0] + (bytes[1] << 8) + (bytes[2] << 16) + (bytes[3] << 24)) >>> 0);
  const valueInverted = ((bytes[4] + (bytes[5] << 8) + (bytes[6] << 16) + (bytes[7] << 24)) >>> 0);
  const valueBackup = ((bytes[8] + (bytes[9] << 8) + (bytes[10] << 16) + (bytes[11] << 24)) >>> 0);
  
  // 讀取地址字節
  const addr = bytes[12];
  const addrInverted = bytes[13];
  const addrBackup = bytes[14];
  const addrInvertedBackup = bytes[15];
  
  // 驗證格式 - 使用無符號 32 位元運算
  const valueValid = ((value ^ valueInverted) >>> 0) === 0xFFFFFFFF;
  const valueBackupValid = value === valueBackup;
  const addrValid = (addr ^ addrInverted) === 0xFF;
  const addrBackupValid = addr === addrBackup && addrInverted === addrInvertedBackup;
  
  return {
    value,
    valueInverted,
    valueBackup,
    addr,
    addrInverted,
    addrBackup,
    addrInvertedBackup,
    isValid: valueValid && valueBackupValid && addrValid && addrBackupValid,
    validationErrors: {
      valueInverted: !valueValid,
      valueBackup: !valueBackupValid,
      addrInverted: !addrValid,
      addrBackup: !addrBackupValid
    }
  };
};

// 建立 Value Block 格式的十六進制字串
const createValueBlock = (value: number, address: number = 0x06) => {
  // 確保值在 32 位元範圍內，使用無符號運算
  const val = (value >>> 0);
  const valInverted = ((~val) >>> 0);
  const addr = address & 0xFF;
  const addrInverted = (~addr) & 0xFF;
  
  // 將 32 位元值轉換為 Little Endian 格式的 4 個位元組
  const valueBytes = [
    val & 0xFF,
    (val >> 8) & 0xFF,
    (val >> 16) & 0xFF,
    (val >> 24) & 0xFF
  ];
  
  const valueInvertedBytes = [
    valInverted & 0xFF,
    (valInverted >> 8) & 0xFF,
    (valInverted >> 16) & 0xFF,
    (valInverted >> 24) & 0xFF
  ];
  
  // 組合成完整的 16 位元組格式
  const blockData = [
    ...valueBytes,        // 0-3: 值
    ...valueInvertedBytes, // 4-7: 值的反轉
    ...valueBytes,        // 8-11: 值的備份
    addr,                 // 12: 地址
    addrInverted,         // 13: 地址的反轉
    addr,                 // 14: 地址的備份
    addrInverted          // 15: 地址反轉的備份
  ];
  
  // 轉換為十六進制字串
  return blockData.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
};

// 模擬 Mifare Classic 1K 的記憶體佈局
const memoryData: MemoryBlock[] = [
  // 扇區 0 - 製造商區塊
  {
    block: 0, sector: 0, address: 0x00,
    data: "deadbeef220804006263646566676869",
    type: 'manufacturer',
    description: "製造商區塊：包含 UID、BCC、SAK 等製造商資訊",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  },
  // 扇區 0 - 資料區塊
  {
    block: 1, sector: 0, address: 0x01,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：用於儲存應用程式資料"
  },
  {
    block: 2, sector: 0, address: 0x02,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：用於儲存應用程式資料"
  },
  // 扇區 0 - 扇區尾塊
  {
    block: 3, sector: 0, address: 0x03,
    data: "FFFFFFFFFFFF078069FFFFFFFFFFFF",
    type: 'trailer',
    description: "扇區尾塊：包含金鑰 A、存取位元、金鑰 B",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  },
  // 扇區 1
  {
    block: 4, sector: 1, address: 0x04,
    data: "12345678901234567890123456789012",
    type: 'data',
    description: "資料區塊：應用程式自定義資料"
  },
  (() => {
    const valueData = createValueBlock(100, 0x05);
    return {
      block: 5, sector: 1, address: 0x05,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：儲存餘額 100 元",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 6, sector: 1, address: 0x06,
    data: "ABCDEFABCDEFABCDEFABCDEFABCDEFAB",
    type: 'data',
    description: "資料區塊：應用程式自定義資料"
  },
  {
    block: 7, sector: 1, address: 0x07,
    data: "A0A1A2A3A4A5078069B0B1B2B3B4B5",
    type: 'trailer',
    description: "扇區尾塊：包含金鑰 A、存取位元、金鑰 B",
    keyA: "A0A1A2A3A4A5",
    keyB: "B0B1B2B3B4B5",
    accessBits: "078069"
  },
  // 其他扇區 (簡化版本)
  ...Array.from({ length: 52 }, (_, i) => ({
    block: i + 8,
    sector: Math.floor((i + 8) / 4),
    address: i + 8,
    data: i % 4 === 3 ? "FFFFFFFFFFFF078069FFFFFFFFFFFF" : "00000000000000000000000000000000",
    type: (i % 4 === 3 ? 'trailer' : 'data') as 'trailer' | 'data',
    description: i % 4 === 3 ? "扇區尾塊" : "資料區塊",
    ...(i % 4 === 3 && {
      keyA: "FFFFFFFFFFFF",
      keyB: "FFFFFFFFFFFF", 
      accessBits: "078069"
    })
  })),
  // 在扇區 15 加入另一個值區塊示例
  (() => {
    const valueData = createValueBlock(1500, 0x3C);
    return {
      block: 60, sector: 15, address: 0x3C,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：儲存點數 1500 點",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  // 其餘的尾塊和資料塊
  ...Array.from({ length: 3 }, (_, i) => {
    const blockNum = 61 + i;
    const isTrailer = blockNum === 63;
    return {
      block: blockNum,
      sector: 15,
      address: blockNum,
      data: isTrailer ? "FFFFFFFFFFFF078069FFFFFFFFFFFF" : "00000000000000000000000000000000",
      type: (isTrailer ? 'trailer' : 'data') as 'trailer' | 'data',
      description: isTrailer ? "扇區尾塊" : "資料區塊",
      ...(isTrailer && {
        keyA: "FFFFFFFFFFFF",
        keyB: "FFFFFFFFFFFF", 
        accessBits: "078069"
      })
    };
  })
];

type HighlightType = 'uid' | 'bcc' | 'sak' | 'atqa' | 'manufacturer_data' | 'key_a' | 'access_bits' | 'key_b' | 'value' | 'value_inverted' | 'address_backup' | 'normal';

const getHighlightColor = (type: HighlightType): string => {
  switch (type) {
    case 'uid': return 'bg-blue-500';
    case 'bcc': return 'bg-cyan-500';
    case 'sak': return 'bg-indigo-500';
    case 'atqa': return 'bg-purple-500';
    case 'manufacturer_data': return 'bg-slate-500';
    case 'key_a': return 'bg-red-500';
    case 'access_bits': return 'bg-yellow-500';
    case 'key_b': return 'bg-orange-500';
    case 'value': return 'bg-green-500';
    case 'value_inverted': return 'bg-green-600';
    case 'address_backup': return 'bg-green-400';
    case 'normal': return 'bg-slate-700';
    default: return 'bg-slate-700';
  }
};

const getHighlightDescription = (type: HighlightType): string => {
  switch (type) {
    case 'uid': return 'UID - 卡片唯一識別碼';
    case 'bcc': return 'BCC - 區塊檢查字元';
    case 'sak': return 'SAK - 選取確認位元組';
    case 'atqa': return 'ATQA - 答詢回應';
    case 'manufacturer_data': return '製造商資料';
    case 'key_a': return '金鑰 A - 用於驗證';
    case 'access_bits': return '存取位元 - 控制讀寫權限';
    case 'key_b': return '金鑰 B - 用於驗證';
    case 'value': return '值資料';
    case 'value_inverted': return '值的反轉備份';
    case 'address_backup': return '地址備份';
    case 'normal': return '一般資料';
    default: return '未知資料類型';
  }
};

const getByteHighlight = (block: MemoryBlock, byteIndex: number): HighlightType => {
  if (block.type === 'manufacturer' && block.block === 0) {
    if (byteIndex >= 0 && byteIndex <= 3) return 'uid';
    if (byteIndex === 4) return 'bcc';
    if (byteIndex === 5) return 'sak';
    if (byteIndex >= 6 && byteIndex <= 7) return 'atqa';
    return 'manufacturer_data';
  }
  
  if (block.type === 'trailer') {
    if (byteIndex >= 0 && byteIndex <= 5) return 'key_a';
    if (byteIndex >= 6 && byteIndex <= 8) return 'access_bits';
    if (byteIndex === 9) return 'normal';
    if (byteIndex >= 10 && byteIndex <= 15) return 'key_b';
  }
  
  if (block.type === 'value') {
    if (byteIndex >= 0 && byteIndex < 4) return 'value';
    if (byteIndex >= 4 && byteIndex < 8) return 'value_inverted';
    if (byteIndex >= 8 && byteIndex < 12) return 'value';
    return 'address_backup';
  }
  
  return 'normal';
};

const getDataGroupRange = (block: MemoryBlock, byteIndex: number): { start: number; end: number; type: HighlightType } => {
  if (block.type === 'manufacturer' && block.block === 0) {
    if (byteIndex >= 0 && byteIndex <= 3) return { start: 0, end: 3, type: 'uid' };
    if (byteIndex === 4) return { start: 4, end: 4, type: 'bcc' };
    if (byteIndex === 5) return { start: 5, end: 5, type: 'sak' };
    if (byteIndex >= 6 && byteIndex <= 7) return { start: 6, end: 7, type: 'atqa' };
    return { start: 8, end: 15, type: 'manufacturer_data' };
  }
  
  if (block.type === 'trailer') {
    if (byteIndex >= 0 && byteIndex <= 5) return { start: 0, end: 5, type: 'key_a' };
    if (byteIndex >= 6 && byteIndex <= 8) return { start: 6, end: 8, type: 'access_bits' };
    if (byteIndex === 9) return { start: 9, end: 9, type: 'normal' };
    if (byteIndex >= 10 && byteIndex <= 15) return { start: 10, end: 15, type: 'key_b' };
  }
  
  if (block.type === 'value') {
    if (byteIndex >= 0 && byteIndex < 4) return { start: 0, end: 3, type: 'value' };
    if (byteIndex >= 4 && byteIndex < 8) return { start: 4, end: 7, type: 'value_inverted' };
    if (byteIndex >= 8 && byteIndex < 12) return { start: 8, end: 11, type: 'value_inverted' };
    return { start: 12, end: 15, type: 'address_backup' };
  }
  
  return { start: 0, end: 15, type: 'normal' };
};

// 獲取扇區的 Trailer Block 資訊
const getSectorTrailerInfo = (sectorNumber: number, memoryData: MemoryBlock[]) => {
  const trailerBlock = memoryData.find(block => 
    block.sector === sectorNumber && block.type === 'trailer'
  );
  return trailerBlock;
};

const HexEditor = ({ 
  data, 
  selectedBlock, 
  onBlockSelect,
  selectedSector 
}: { 
  data: MemoryBlock[]; 
  selectedBlock: number | null;
  onBlockSelect: (block: number) => void;
  selectedSector: number | null;
}) => {
  const [hoveredGroup, setHoveredGroup] = useState<{blockIndex: number, start: number, end: number} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 當選擇的扇區改變時，自動滾動到該扇區
  useEffect(() => {
    if (selectedSector !== null && scrollContainerRef.current) {
      const sectorElement = scrollContainerRef.current.querySelector(`[data-sector="${selectedSector}"]`);
      if (sectorElement) {
        sectorElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }
  }, [selectedSector]);

  return (
    <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm h-full flex flex-col">
      {/* Header - 固定在頂部 */}
      <div className="grid mb-2 sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm py-2 flex-shrink-0" style={{ gridTemplateColumns: '64px 1fr' }}>
        <div className="text-slate-400 text-xs flex items-center justify-center">Addr</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
          {[...Array(16)].map((_, i) => (
            <div key={i} className="text-slate-400 text-xs text-center p-0.5">
              {i.toString(16).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      
      {/* 滾動容器 - 只有這個區域會滾動 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 min-h-0">
        {data.map((block, blockIndex) => {
          const isSelected = selectedBlock === blockIndex;
          const isTrailer = block.type === 'trailer';
          const isSectorStart = block.block % 4 === 0; // 每個扇區的第一個區塊
          
          // 顯示完整資料，包括 trailer block 的金鑰
          const displayBytes = block.data.match(/.{2}/g) || [];
          
          return (
            <div key={blockIndex}>
              {/* 扇區標識 */}
              {isSectorStart && (
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-2" data-sector={block.sector}>
                  <div className="flex-1 h-px bg-slate-600"></div>
                  <span className="px-2 bg-slate-800 rounded">扇區 {block.sector}</span>
                  <div className="flex-1 h-px bg-slate-600"></div>
                </div>
              )}
              
              <motion.div
                className={`grid ${isTrailer ? 'mb-2' : ''}`}
                style={{ gridTemplateColumns: '64px 1fr' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: blockIndex * 0.005 }}
              >
                {/* Address */}
                <div className="text-slate-400 text-xs flex items-center justify-center px-2 py-0.5 border-r border-slate-600 bg-slate-800/50 w-16">
                  0x{block.address.toString(16).toUpperCase().padStart(2, '0')}
                </div>
                
                {/* Data bytes with group-level borders */}
                <div className="grid gap-0 relative" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
                  {[...Array(16)].map((_, byteIndex) => {
                    const byte = displayBytes[byteIndex] || '00';
                    const highlightType = getByteHighlight(block, byteIndex);
                    const highlightColor = getHighlightColor(highlightType);
                    const groupRange = getDataGroupRange(block, byteIndex);
                    
                    const isInHoveredGroup = hoveredGroup && 
                      hoveredGroup.blockIndex === blockIndex &&
                      byteIndex >= hoveredGroup.start && 
                      byteIndex <= hoveredGroup.end;
                    
                    return (
                      <motion.button
                        key={byteIndex}
                        onClick={() => onBlockSelect(blockIndex)}
                        onMouseEnter={() => setHoveredGroup({
                          blockIndex,
                          start: groupRange.start,
                          end: groupRange.end
                        })}
                        onMouseLeave={() => setHoveredGroup(null)}
                        className={`
                          relative h-5 text-xs flex items-center justify-center transition-all font-bold text-white
                          ${isSelected 
                            ? `${highlightColor}` 
                            : `${highlightColor}`
                          }
                          ${isInHoveredGroup ? 'z-10 shadow-lg scale-110' : ''}
                        `}
                        title={`位元組 ${byteIndex}: ${byte} - ${getHighlightDescription(highlightType)}`}
                      >
                        {byte}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BlockBasicInfo = ({ 
  block
}: { 
  block: MemoryBlock | null;
}) => {
  if (!block) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 text-center text-slate-400 text-sm">
        選擇一個記憶體區塊查看詳細資訊
      </div>
    );
  }

  return (
    <motion.div
      key={block.block}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-lg p-3 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded ${
          block.type === 'manufacturer' ? 'bg-blue-600' :
          block.type === 'data' ? 'bg-slate-600' :
          block.type === 'value' ? 'bg-green-600' :
          'bg-red-600'
        }`}></div>
        <h3 className="text-sm font-bold">
          區塊 {block.block} (0x{block.address.toString(16).toUpperCase().padStart(2, '0')})
        </h3>
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <h4 className="font-bold text-slate-300 mb-1">基本資訊</h4>
          <div className="space-y-0.5">
            <div>扇區: {block.sector}</div>
            <div>類型: {
              block.type === 'manufacturer' ? '製造商' :
              block.type === 'data' ? '資料' :
              block.type === 'value' ? '值' :
              '尾塊'
            }</div>
            <div>地址: 0x{block.address.toString(16).toUpperCase().padStart(2, '0')}</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-300 mb-1">原始資料</h4>
          <div className="bg-slate-900 p-2 rounded font-mono text-xs break-all">
            {block.data}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const BlockStructureDetails = ({ 
  block,
  selectedSector,
  memoryData
}: { 
  block: MemoryBlock | null;
  selectedSector: number | null;
  memoryData: MemoryBlock[];
}) => {
  const selectedTrailerInfo = selectedSector !== null ? getSectorTrailerInfo(selectedSector, memoryData) : null;
  
  if (!block) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 text-center text-slate-400 text-sm">
        選擇區塊查看資料結構
      </div>
    );
  }

  return (
    <motion.div
      key={`structure-${block.block}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-lg p-3 space-y-3"
    >
      <h3 className="text-sm font-bold">資料結構詳細</h3>
      
      {/* 顯示選中扇區的金鑰資訊 */}
      {selectedTrailerInfo && (
        <div className="p-2 bg-slate-900/50 rounded">
          <h5 className="font-bold text-slate-300 mb-2 text-xs">扇區 {selectedSector} 驗證資訊</h5>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-red-400 font-bold">金鑰 A:</span>
              <span className="font-mono">{selectedTrailerInfo.keyA}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-400 font-bold">存取位元:</span>
              <span className="font-mono">{selectedTrailerInfo.accessBits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-orange-400 font-bold">金鑰 B:</span>
              <span className="font-mono">{selectedTrailerInfo.keyB}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 特殊區塊詳細資訊 */}
      {block.type === 'trailer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">扇區尾塊結構</h4>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="bg-red-900/30 p-2 rounded">
              <div className="font-bold text-red-400 mb-1">金鑰 A</div>
              <div className="font-mono text-xs">
                {block.keyA}
              </div>
            </div>
            <div className="bg-yellow-900/30 p-2 rounded">
              <div className="font-bold text-yellow-400 mb-1">存取位元</div>
              <div className="font-mono text-xs">{block.accessBits}</div>
            </div>
            <div className="bg-purple-900/30 p-2 rounded">
              <div className="font-bold text-purple-400 mb-1">金鑰 B</div>
              <div className="font-mono text-xs">
                {block.keyB}
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'value' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">值區塊結構</h4>
          {(() => {
            const valueInfo = block.valueInfo;
            if (!valueInfo) {
              return (
                <div className="bg-red-900/30 p-2 rounded text-xs">
                  <div className="font-bold text-red-400 mb-1">格式錯誤</div>
                  <div className="text-slate-400">無法解析值區塊格式</div>
                </div>
              );
            }
            
            return (
              <div className="space-y-1 text-xs">
                <div className={`p-2 rounded ${valueInfo.isValid ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <div className={`font-bold mb-1 ${valueInfo.isValid ? 'text-green-400' : 'text-red-400'}`}>
                    數值: {valueInfo.value} (0x{valueInfo.value.toString(16).toUpperCase().padStart(8, '0')})
                  </div>
                  <div className="text-slate-400">
                    {valueInfo.isValid ? '格式驗證通過' : '格式驗證失敗'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-1">
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.valueInverted ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">值反轉</div>
                    <div>0x{valueInfo.valueInverted.toString(16).toUpperCase().padStart(8, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.valueBackup ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">值備份</div>
                    <div>0x{valueInfo.valueBackup.toString(16).toUpperCase().padStart(8, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.addrInverted ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">地址</div>
                    <div>0x{valueInfo.addr.toString(16).toUpperCase().padStart(2, '0')} / 0x{valueInfo.addrInverted.toString(16).toUpperCase().padStart(2, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.addrBackup ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">地址備份</div>
                    <div>0x{valueInfo.addrBackup.toString(16).toUpperCase().padStart(2, '0')} / 0x{valueInfo.addrInvertedBackup.toString(16).toUpperCase().padStart(2, '0')}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {block.type === 'manufacturer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">製造商資料結構</h4>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="bg-blue-900/30 p-2 rounded">
              <div className="font-bold text-blue-400 mb-1">UID (0-3 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(0, 8).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
            <div className="bg-cyan-900/30 p-2 rounded">
              <div className="font-bold text-cyan-400 mb-1">BCC (4 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(8, 10).toUpperCase()}
              </div>
            </div>
            <div className="bg-indigo-900/30 p-2 rounded">
              <div className="font-bold text-indigo-400 mb-1">SAK (5 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(10, 12).toUpperCase()}
              </div>
            </div>
            <div className="bg-purple-900/30 p-2 rounded">
              <div className="font-bold text-purple-400 mb-1">ATQA (6-7 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(12, 16).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
            <div className="bg-slate-900/30 p-2 rounded">
              <div className="font-bold text-slate-400 mb-1">製造商資料 (8-15 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(16, 32).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'data' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">資料區塊</h4>
          <div className="bg-slate-900/30 p-2 rounded text-xs">
            <div className="text-slate-400">此區塊用於儲存應用程式資料，可自由讀寫。</div>
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
    <div className="bg-slate-800/50 rounded-lg p-3">
      <h4 className="font-bold mb-2 text-sm">記憶體配置圖</h4>
      <div className="grid grid-cols-4 gap-1">
        {[...Array(16)].map((_, sector) => (
          <motion.button
            key={sector}
            onClick={() => onSectorSelect(sector)}
            className={`
              p-2 rounded text-xs font-medium transition-all
              ${selectedSector === sector 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div>扇區{sector}</div>
            <div className="text-xs opacity-75">
              {sector === 0 ? '製造商' : '資料'}
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="mt-2 text-xs text-slate-400">
        總容量: 1024 bytes
      </div>
    </div>
  );
};

export default function MemoryPage() {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [selectedSector, setSelectedSector] = useState<number | null>(0);

  const handleSectorSelect = (sector: number) => {
    setSelectedSector(sector);
    // 自動選擇該扇區的第一個區塊
    const firstBlockInSector = memoryData.findIndex(block => block.sector === sector);
    if (firstBlockInSector !== -1) {
      setSelectedBlock(firstBlockInSector);
    }
  };

  const selectedBlockData = selectedBlock !== null ? memoryData[selectedBlock] : null;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col overflow-hidden">
      <div className="container mx-auto px-4 py-4 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mifare Classic 記憶體分布
            </h1>
          </div>
        </motion.div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Hex Editor */}
          <div className="flex-shrink-0 flex flex-col min-h-0" style={{ width: '600px' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-4 flex-1 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-lg font-bold">十六進制編輯器視圖</h3>
              </div>
              
              {/* 詳細圖例 - 固定不滾動 */}
              <div className="mb-3 p-2 bg-slate-900/50 rounded-lg flex-shrink-0">
                <h4 className="text-xs font-bold mb-1">資料類型圖例</h4>
                <div className="grid grid-cols-5 lg:grid-cols-10 gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                    <span>UID</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-cyan-500 rounded-sm"></div>
                    <span>BCC</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-sm"></div>
                    <span>SAK</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
                    <span>ATQA</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
                    <span>金鑰A</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-sm"></div>
                    <span>存取位元</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-sm"></div>
                    <span>金鑰B</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                    <span>值資料</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-500 rounded-sm"></div>
                    <span>製造商</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-700 rounded-sm"></div>
                    <span>一般</span>
                  </div>
                </div>
              </div>
              
              {/* HexEditor 容器 - 可滾動 */}
              <div className="flex-1 flex flex-col min-h-0">
                <HexEditor 
                  data={memoryData}
                  selectedBlock={selectedBlock}
                  onBlockSelect={setSelectedBlock}
                  selectedSector={selectedSector}
                />
              </div>
            </motion.div>

            {/* 統計資訊 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid md:grid-cols-4 gap-2"
            >
              <div className="bg-blue-900/30 p-2 rounded text-center">
                <div className="text-lg font-bold text-blue-400">1</div>
                <div className="text-xs text-slate-400">製造商區塊</div>
              </div>
              <div className="bg-slate-700/30 p-2 rounded text-center">
                <div className="text-lg font-bold text-slate-400">47</div>
                <div className="text-xs text-slate-400">資料區塊</div>
              </div>
              <div className="bg-green-900/30 p-2 rounded text-center">
                <div className="text-lg font-bold text-green-400">1</div>
                <div className="text-xs text-slate-400">值區塊</div>
              </div>
              <div className="bg-red-900/30 p-2 rounded text-center">
                <div className="text-lg font-bold text-red-400">16</div>
                <div className="text-xs text-slate-400">扇區尾塊</div>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 - 左右分欄 */}
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-4 min-h-0">
            {/* 左欄 */}
            <div className="space-y-3 flex flex-col min-h-0">
              {/* 記憶體配置圖 */}
              <MemoryMap 
                onSectorSelect={handleSectorSelect}
                selectedSector={selectedSector}
              />

              {/* 區塊基本資料 */}
              <div className="flex-1 min-h-0">
                <BlockBasicInfo 
                  block={selectedBlockData}
                />
              </div>
            </div>

            {/* 右欄 */}
            <div className="space-y-3 flex flex-col min-h-0">
              {/* 區塊詳細結構 */}
              <div className="flex-1 min-h-0">
                <BlockStructureDetails 
                  block={selectedBlockData}
                  selectedSector={selectedSector}
                  memoryData={memoryData}
                />
              </div>

              {/* 存取控制說明 */}
              <div className="bg-slate-800/50 rounded-lg p-3">
                <h4 className="font-bold mb-2 flex items-center gap-2 text-sm">
                  <Info size={16} className="text-blue-400" />
                  存取控制
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="font-bold text-yellow-400 mb-0.5">存取位元</div>
                    <div className="text-slate-400">控制讀寫權限，位於扇區尾塊第 6-8 位元組</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-400 mb-0.5">金鑰權限</div>
                    <div className="text-slate-400">金鑰 A 用於讀取，金鑰 B 用於寫入</div>
                  </div>
                  <div>
                    <div className="font-bold text-purple-400 mb-0.5">預設值</div>
                    <div className="text-slate-400">預設金鑰 FFFFFFFFFFFF，存取位元 078069</div>
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
