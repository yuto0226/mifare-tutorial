'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

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

// 根據官方規格生成正確的 C1C2C3 組合的 access bits
const generateOfficialAccessBits = (c1c2c3: string): string => {
  // 確保輸入是3位二進制字符串
  if (!/^[01]{3}$/.test(c1c2c3)) {
    throw new Error(`無效的 C1C2C3 值: ${c1c2c3}`);
  }
  
  const c1 = parseInt(c1c2c3[0]);
  const c2 = parseInt(c1c2c3[1]); 
  const c3 = parseInt(c1c2c3[2]);
  
  // 計算反轉位元
  const notC1 = 1 - c1;
  const notC2 = 1 - c2;
  const notC3 = 1 - c3;
  
  // 對於每個區塊（0,1,2,3），這裡示範所有區塊使用相同的 C1C2C3
  // Byte 6: !C2_3,!C2_2,!C2_1,!C2_0,!C1_3,!C1_2,!C1_1,!C1_0
  const byte6 = (notC2 << 7) | (notC2 << 6) | (notC2 << 5) | (notC2 << 4) |
                (notC1 << 3) | (notC1 << 2) | (notC1 << 1) | (notC1 << 0);
  
  // Byte 7: C1_3,C1_2,C1_1,C1_0,!C3_3,!C3_2,!C3_1,!C3_0
  const byte7 = (c1 << 7) | (c1 << 6) | (c1 << 5) | (c1 << 4) |
                (notC3 << 3) | (notC3 << 2) | (notC3 << 1) | (notC3 << 0);
  
  // Byte 8: C3_3,C3_2,C3_1,C3_0,C2_3,C2_2,C2_1,C2_0  
  const byte8 = (c3 << 7) | (c3 << 6) | (c3 << 5) | (c3 << 4) |
                (c2 << 3) | (c2 << 2) | (c2 << 1) | (c2 << 0);
  
  // 轉換為十六進制字符串
  return byte6.toString(16).padStart(2, '0').toUpperCase() +
         byte7.toString(16).padStart(2, '0').toUpperCase() +
         byte8.toString(16).padStart(2, '0').toUpperCase();
};

// 根據四個區塊的個別權限設定生成 access bits
const generateAccessBitsByBlocks = (block0: number, block1: number, block2: number, block3: number): string => {
  // 驗證輸入範圍 (0-7)
  const blocks = [block0, block1, block2, block3];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] < 0 || blocks[i] > 7 || !Number.isInteger(blocks[i])) {
      throw new Error(`區塊 ${i} 的權限值必須是 0-7 的整數，收到: ${blocks[i]}`);
    }
  }
  
  // 將 0-7 的值轉換為 3 位二進制 (C1C2C3)
  const toBinary = (value: number): { c1: number, c2: number, c3: number } => {
    return {
      c1: (value >> 2) & 1,  // 最高位
      c2: (value >> 1) & 1,  // 中間位
      c3: value & 1          // 最低位
    };
  };
  
  const block0Bits = toBinary(block0);
  const block1Bits = toBinary(block1);
  const block2Bits = toBinary(block2);
  const block3Bits = toBinary(block3);
  
  // 計算反轉位元
  const notC1_0 = 1 - block0Bits.c1;
  const notC1_1 = 1 - block1Bits.c1;
  const notC1_2 = 1 - block2Bits.c1;
  const notC1_3 = 1 - block3Bits.c1;
  
  const notC2_0 = 1 - block0Bits.c2;
  const notC2_1 = 1 - block1Bits.c2;
  const notC2_2 = 1 - block2Bits.c2;
  const notC2_3 = 1 - block3Bits.c2;
  
  const notC3_0 = 1 - block0Bits.c3;
  const notC3_1 = 1 - block1Bits.c3;
  const notC3_2 = 1 - block2Bits.c3;
  const notC3_3 = 1 - block3Bits.c3;
  
  // 根據 Mifare Classic 規格構建位元組
  // Byte 6: !C2_3,!C2_2,!C2_1,!C2_0,!C1_3,!C1_2,!C1_1,!C1_0
  const byte6 = (notC2_3 << 7) | (notC2_2 << 6) | (notC2_1 << 5) | (notC2_0 << 4) |
                (notC1_3 << 3) | (notC1_2 << 2) | (notC1_1 << 1) | (notC1_0 << 0);
  
  // Byte 7: C1_3,C1_2,C1_1,C1_0,!C3_3,!C3_2,!C3_1,!C3_0
  const byte7 = (block3Bits.c1 << 7) | (block2Bits.c1 << 6) | (block1Bits.c1 << 5) | (block0Bits.c1 << 4) |
                (notC3_3 << 3) | (notC3_2 << 2) | (notC3_1 << 1) | (notC3_0 << 0);
  
  // Byte 8: C3_3,C3_2,C3_1,C3_0,C2_3,C2_2,C2_1,C2_0
  const byte8 = (block3Bits.c3 << 7) | (block2Bits.c3 << 6) | (block1Bits.c3 << 5) | (block0Bits.c3 << 4) |
                (block3Bits.c2 << 3) | (block2Bits.c2 << 2) | (block1Bits.c2 << 1) | (block0Bits.c2 << 0);
  
  // 轉換為十六進制字符串
  return byte6.toString(16).padStart(2, '0').toUpperCase() +
         byte7.toString(16).padStart(2, '0').toUpperCase() +
         byte8.toString(16).padStart(2, '0').toUpperCase();
};

// 模擬 Mifare Classic 1K 的記憶體佈局 - 多元化存取位元配置
const memoryData: MemoryBlock[] = [
  // 扇區 0 - 製造商區塊 (混合權限配置)
  {
    block: 0, sector: 0, address: 0x00,
    data: "deadbeef220804006263646566676869",
    type: 'manufacturer',
    description: "製造商區塊：包含 UID、BCC、SAK 等製造商資訊",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: generateAccessBitsByBlocks(4, 4, 4, 0) // 資料區塊只讀，尾塊預設
  },
  // 扇區 0 - 資料區塊
  {
    block: 1, sector: 0, address: 0x01,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：只讀保護"
  },
  {
    block: 2, sector: 0, address: 0x02,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：只讀保護"
  },
  // 扇區 0 - 尾塊 (混合權限：資料只讀，尾塊預設)
  {
    block: 3, sector: 0, address: 0x03,
    data: `FFFFFFFFFFFF${generateAccessBitsByBlocks(4, 4, 4, 0)}FFFFFFFFFFFF`,
    type: 'trailer',
    description: "扇區尾塊：混合模式 - 資料區塊只讀，尾塊預設權限",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: generateAccessBitsByBlocks(4, 4, 4, 0)
  },
  // 扇區 1 - 漸進式權限配置 (0→1→2→3)
  {
    block: 4, sector: 1, address: 0x04,
    data: "12345678901234567890123456789012",
    type: 'data',
    description: "資料區塊：完全開放 (000)"
  },
  (() => {
    const valueData = createValueBlock(100, 0x05);
    return {
      block: 5, sector: 1, address: 0x05,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：金鑰 B 控制 (001)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 6, sector: 1, address: 0x06,
    data: "ABCDEFABCDEFABCDEFABCDEFABCDEFAB",
    type: 'data',
    description: "資料區塊：公開讀取 (010)"
  },
  {
    block: 7, sector: 1, address: 0x07,
    data: `A0A1A2A3A4A5${generateAccessBitsByBlocks(0, 1, 2, 3)}B0B1B2B3B4B5`,
    type: 'trailer',
    description: "扇區尾塊：漸進式權限 - Block0(000)→Block1(001)→Block2(010)→Trailer(011)",
    keyA: "A0A1A2A3A4A5",
    keyB: "B0B1B2B3B4B5",
    accessBits: generateAccessBitsByBlocks(0, 1, 2, 3)
  },
  // 扇區 2 - 高安全性配置 (4→5→6→7)
  {
    block: 8, sector: 2, address: 0x08,
    data: "524541444F4E4C59444154414442434B",
    type: 'data',
    description: "資料區塊：只讀模式 (100)"
  },
  {
    block: 9, sector: 2, address: 0x09,
    data: "434F4E4649444D5F434F4E464947555F",
    type: 'data',
    description: "資料區塊：金鑰 B 只讀 (101)"
  },
  {
    block: 10, sector: 2, address: 0x0A,
    data: "50524F54454354454452454144444154",
    type: 'data',
    description: "資料區塊：金鑰 B 嚴格控制 (110)"
  },
  {
    block: 11, sector: 2, address: 0x0B,
    data: `C1C2C3C4C5C6${generateAccessBitsByBlocks(4, 5, 6, 7)}C6C7C8C9CACB`,
    type: 'trailer',
    description: "扇區尾塊：高安全性配置 - 從只讀到完全禁止",
    keyA: "C1C2C3C4C5C6",
    keyB: "C6C7C8C9CACB",
    accessBits: generateAccessBitsByBlocks(4, 5, 6, 7)
  },
  // 扇區 3 - 值區塊專用配置
  (() => {
    const valueData = createValueBlock(250, 0x0C);
    return {
      block: 12, sector: 3, address: 0x0C,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：全開放值操作 (000)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  (() => {
    const valueData = createValueBlock(500, 0x0D);
    return {
      block: 13, sector: 3, address: 0x0D,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：金鑰 B 值操作 (001)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  (() => {
    const valueData = createValueBlock(750, 0x0E);
    return {
      block: 14, sector: 3, address: 0x0E,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：公開讀取 (010)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 15, sector: 3, address: 0x0F,
    data: `D1D2D3D4D5D6${generateAccessBitsByBlocks(0, 1, 2, 1)}D6D7D8D9DADB`,
    type: 'trailer',
    description: "扇區尾塊：值區塊優化配置",
    keyA: "D1D2D3D4D5D6",
    keyB: "D6D7D8D9DADB",
    accessBits: generateAccessBitsByBlocks(0, 1, 2, 1)
  },
  // 扇區 4 - 數據保護配置
  {
    block: 16, sector: 4, address: 0x10,
    data: "494D504F5254414E5444415441424C4F",
    type: 'data',
    description: "重要資料：公開讀取，需金鑰寫入 (010)"
  },
  {
    block: 17, sector: 4, address: 0x11,
    data: "434B494E464F524D4154494F4E444154",
    type: 'data',
    description: "資料區塊：金鑰 B 控制讀寫 (006)"
  },
  {
    block: 18, sector: 4, address: 0x12,
    data: "56414C5545424C4F434B434F4E464947",
    type: 'data',
    description: "配置資料：只讀模式 (100)"
  },
  {
    block: 19, sector: 4, address: 0x13,
    data: `E1E2E3E4E5E6${generateAccessBitsByBlocks(2, 6, 4, 2)}E6E7E8E9EAEB`,
    type: 'trailer',
    description: "扇區尾塊：數據保護配置 - 分級權限管理",
    keyA: "E1E2E3E4E5E6",
    keyB: "E6E7E8E9EAEB",
    accessBits: generateAccessBitsByBlocks(2, 6, 4, 2)
  },
  // 扇區 5 - 應用程式配置
  {
    block: 20, sector: 5, address: 0x14,
    data: "4150504C49434154494F4E44415441",
    type: 'data',
    description: "應用程式資料：完全開放 (000)"
  },
  {
    block: 21, sector: 5, address: 0x15,
    data: "434F4E4649475552415449204F4E4441",
    type: 'data',
    description: "配置資料：完全開放 (000)"
  },
  (() => {
    const valueData = createValueBlock(1000, 0x16);
    return {
      block: 22, sector: 5, address: 0x16,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：完全開放 (000)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 23, sector: 5, address: 0x17,
    data: `F1F2F3F4F5F6${generateAccessBitsByBlocks(0, 0, 0, 0)}F6F7F8F9FAFB`,
    type: 'trailer',
    description: "扇區尾塊：應用程式配置 - 全開放模式",
    keyA: "F1F2F3F4F5F6",
    keyB: "F6F7F8F9FAFB",
    accessBits: generateAccessBitsByBlocks(0, 0, 0, 0)
  },
  // 扇區 6 - 安全存取配置
  {
    block: 24, sector: 6, address: 0x18,
    data: "5345435552494459494D504F5254414E",
    type: 'data',
    description: "安全資料：金鑰 B 嚴格控制 (110)"
  },
  {
    block: 25, sector: 6, address: 0x19,
    data: "434F4E464944454E5449414C444154",
    type: 'data',
    description: "機密資料：金鑰 B 嚴格控制 (110)"
  },
  {
    block: 26, sector: 6, address: 0x1A,
    data: "50524956415445494E464F524D415449",
    type: 'data',
    description: "私人資料：金鑰 B 嚴格控制 (110)"
  },
  {
    block: 27, sector: 6, address: 0x1B,
    data: `010203040506${generateAccessBitsByBlocks(6, 6, 6, 6)}060708090A0B`,
    type: 'trailer',
    description: "扇區尾塊：安全存取配置 - 全部金鑰 B 嚴格控制",
    keyA: "010203040506",
    keyB: "060708090A0B",
    accessBits: generateAccessBitsByBlocks(6, 6, 6, 6)
  },
  // 扇區 7 - 最高安全性配置
  {
    block: 28, sector: 7, address: 0x1C,
    data: "4C4F434B454444415441424C4F434B",
    type: 'data',
    description: "鎖定資料：完全禁止存取 (111)"
  },
  {
    block: 29, sector: 7, address: 0x1D,
    data: "504552414E454E544C594C4F434B4544",
    type: 'data',
    description: "永久鎖定：完全禁止存取 (111)"
  },
  {
    block: 30, sector: 7, address: 0x1E,
    data: "4E4F41434345535349484946495845",
    type: 'data',
    description: "不可存取：完全禁止存取 (111)"
  },
  {
    block: 31, sector: 7, address: 0x1F,
    data: `111213141516${generateAccessBitsByBlocks(7, 7, 7, 7)}161718191A1B`,
    type: 'trailer',
    description: "扇區尾塊：最高安全性 - 完全鎖定所有區塊",
    keyA: "111213141516",
    keyB: "161718191A1B",
    accessBits: generateAccessBitsByBlocks(7, 7, 7, 7)
  },
  
  // 扇區 8 - 混合值區塊配置
  (() => {
    const valueData = createValueBlock(750, 0x20);
    return {
      block: 32, sector: 8, address: 0x20,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：公開讀取 (010)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  (() => {
    const valueData = createValueBlock(1250, 0x21);
    return {
      block: 33, sector: 8, address: 0x21,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：金鑰 B 控制 (001)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 34, sector: 8, address: 0x22,
    data: "56414C5545424C4F434B4D495848454D",
    type: 'data',
    description: "資料區塊：只讀模式 (100)"
  },
  {
    block: 35, sector: 8, address: 0x23,
    data: `212223242526${generateAccessBitsByBlocks(2, 1, 4, 2)}262728292A2B`,
    type: 'trailer',
    description: "扇區尾塊：混合值區塊配置",
    keyA: "212223242526",
    keyB: "262728292A2B",
    accessBits: generateAccessBitsByBlocks(2, 1, 4, 2)
  },
  // 扇區 9 - 分層安全配置
  {
    block: 36, sector: 9, address: 0x24,
    data: "50554C424943494E464F524D4154494F",
    type: 'data',
    description: "公開資訊：完全開放 (000)"
  },
  {
    block: 37, sector: 9, address: 0x25,
    data: "4C494D495445444143434553534441544",
    type: 'data',
    description: "受限資料：金鑰 B 讀寫 (001)"
  },
  {
    block: 38, sector: 9, address: 0x26,
    data: "50524956415445494E464F524D415449",
    type: 'data',
    description: "私人資料：金鑰 B 嚴格控制 (110)"
  },
  {
    block: 39, sector: 9, address: 0x27,
    data: `313233343536${generateAccessBitsByBlocks(0, 1, 6, 3)}363738393A3B`,
    type: 'trailer',
    description: "扇區尾塊：分層安全配置",
    keyA: "313233343536",
    keyB: "363738393A3B",
    accessBits: generateAccessBitsByBlocks(0, 1, 6, 3)
  },
  
  // 扇區 10-15 - 多樣化權限展示
  // 扇區 10 - 全公開配置
  {
    block: 40, sector: 10, address: 0x28,
    data: "5055424C494353484152454444415441",
    type: 'data',
    description: "公開共享資料：完全開放"
  },
  {
    block: 41, sector: 10, address: 0x29,
    data: "46524545414343455353494E464F524D",
    type: 'data',
    description: "自由存取資訊：完全開放"
  },
  {
    block: 42, sector: 10, address: 0x2A,
    data: "4F50454E534F5552434549464F524D",
    type: 'data',
    description: "開源資訊：完全開放"
  },
  {
    block: 43, sector: 10, address: 0x2B,
    data: `414243444546${generateAccessBitsByBlocks(0, 0, 0, 0)}464748494A4B`,
    type: 'trailer',
    description: "扇區尾塊：全公開配置",
    keyA: "414243444546",
    keyB: "464748494A4B",
    accessBits: generateAccessBitsByBlocks(0, 0, 0, 0)
  },
  
  // 扇區 11 - 漸進式只讀配置
  {
    block: 44, sector: 11, address: 0x2C,
    data: "454449544142454C524541444F4E4C59",
    type: 'data',
    description: "可編輯轉只讀：公開讀取 (010)"
  },
  {
    block: 45, sector: 11, address: 0x2D,
    data: "524541444F4E4C59414654455257524954",
    type: 'data',
    description: "寫後只讀：只讀模式 (100)"
  },
  {
    block: 46, sector: 11, address: 0x2E,
    data: "50524F54454354454452454144444154",
    type: 'data',
    description: "受保護唯讀：金鑰 B 只讀 (101)"
  },
  {
    block: 47, sector: 11, address: 0x2F,
    data: `515253545556${generateAccessBitsByBlocks(2, 4, 5, 4)}565758595A5B`,
    type: 'trailer',
    description: "扇區尾塊：漸進式只讀配置",
    keyA: "515253545556",
    keyB: "565758595A5B",
    accessBits: generateAccessBitsByBlocks(2, 4, 5, 4)
  },
  
  // 扇區 12-15 預設配置 (簡化)
  {
    block: 48, sector: 12, address: 0x30,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "預設資料區塊"
  },
  {
    block: 49, sector: 12, address: 0x31,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "預設資料區塊"
  },
  {
    block: 50, sector: 12, address: 0x32,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "預設資料區塊"
  },
  {
    block: 51, sector: 12, address: 0x33,
    data: `FFFFFFFFFFFF${generateAccessBitsByBlocks(0, 0, 0, 0)}FFFFFFFFFFFF`,
    type: 'trailer',
    description: "扇區尾塊：預設配置",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: generateAccessBitsByBlocks(0, 0, 0, 0)
  },
  
  // 扇區 13 - 完全鎖定範例
  {
    block: 52, sector: 13, address: 0x34,
    data: "4C4F434B45444441544142434B313233",
    type: 'data',
    description: "鎖定資料：完全禁止 (111)"
  },
  {
    block: 53, sector: 13, address: 0x35,
    data: "4E4F41434345535349424C454441544142",
    type: 'data',
    description: "不可存取：完全禁止 (111)"
  },
  {
    block: 54, sector: 13, address: 0x36,
    data: "50455254414E454E544C594C4F434B4544",
    type: 'data',
    description: "永久鎖定：完全禁止 (111)"
  },
  {
    block: 55, sector: 13, address: 0x37,
    data: `717273747576${generateAccessBitsByBlocks(7, 7, 7, 7)}767778797A7B`,
    type: 'trailer',
    description: "扇區尾塊：完全鎖定配置",
    keyA: "717273747576",
    keyB: "767778797A7B",
    accessBits: generateAccessBitsByBlocks(7, 7, 7, 7)
  },
  
  // 扇區 14-15 - 基本範例
  {
    block: 56, sector: 14, address: 0x38,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "基本資料區塊"
  },
  {
    block: 57, sector: 14, address: 0x39,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "基本資料區塊"
  },
  {
    block: 58, sector: 14, address: 0x3A,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "基本資料區塊"
  },
  {
    block: 59, sector: 14, address: 0x3B,
    data: `FFFFFFFFFFFF${generateAccessBitsByBlocks(1, 2, 3, 1)}FFFFFFFFFFFF`,
    type: 'trailer',
    description: "扇區尾塊：漸進式配置範例",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: generateAccessBitsByBlocks(1, 2, 3, 1)
  },
  {
    block: 60, sector: 15, address: 0x3C,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "最終資料區塊"
  },
  {
    block: 61, sector: 15, address: 0x3D,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "最終資料區塊"
  },
  {
    block: 62, sector: 15, address: 0x3E,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "最終資料區塊"
  },
  {
    block: 63, sector: 15, address: 0x3F,
    data: `FFFFFFFFFFFF${generateAccessBitsByBlocks(0, 0, 0, 0)}FFFFFFFFFFFF`,
    type: 'trailer',
    description: "扇區尾塊：預設配置",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: generateAccessBitsByBlocks(0, 0, 0, 0)
  }
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

// 驗證存取位元格式是否正確
const validateAccessBits = (accessBits: string) => {
  // 檢查基本格式
  if (!accessBits || accessBits.length !== 6) {
    return { valid: false, error: '存取位元必須是6位十六進制字符' };
  }
  
  // 檢查是否為有效十六進制
  if (!/^[0-9A-Fa-f]{6}$/.test(accessBits)) {
    return { valid: false, error: '存取位元包含無效的十六進制字符' };
  }
  
  const hex = accessBits.toUpperCase();
  const byte6 = parseInt(hex.substr(0, 2), 16);
  const byte7 = parseInt(hex.substr(2, 2), 16);
  const byte8 = parseInt(hex.substr(4, 2), 16);
  
  // 檢查反轉位元的一致性
  const errors: string[] = [];
  for (let blockNum = 0; blockNum < 4; blockNum++) {
    const c1 = (byte7 >> (4 + blockNum)) & 1;
    const c2 = (byte8 >> blockNum) & 1;
    const c3 = (byte8 >> (4 + blockNum)) & 1;
    
    const notC1 = (byte6 >> blockNum) & 1;
    const notC2 = (byte6 >> (4 + blockNum)) & 1;
    const notC3 = (byte7 >> blockNum) & 1;
    
    if (c1 !== (1 - notC1)) {
      errors.push(`區塊${blockNum}: C1位元不一致`);
    }
    if (c2 !== (1 - notC2)) {
      errors.push(`區塊${blockNum}: C2位元不一致`);
    }
    if (c3 !== (1 - notC3)) {
      errors.push(`區塊${blockNum}: C3位元不一致`);
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, error: errors.join(', '), details: errors };
  }
  
  return { valid: true };
};

// Mifare Classic 官方 Table 7: Sector Trailer 存取條件
const SECTOR_TRAILER_ACCESS_CONDITIONS = {
  '000': {
    keyA: { read: '禁止', write: 'Key A' },
    accessBits: { read: 'Key A', write: '禁止' },
    keyB: { read: 'Key A', write: 'Key A' },
    description: '默認配置，Key A 可讀寫 Key B 和 Access Bits（不可修改）'
  },
  '001': {
    keyA: { read: '禁止', write: 'Key A' },
    accessBits: { read: 'Key A', write: 'Key A' },
    keyB: { read: 'Key A', write: 'Key A' },
    description: 'Key A 可完全控制，可修改 Access Bits'
  },
  '010': {
    keyA: { read: '禁止', write: '禁止' },
    accessBits: { read: 'Key A', write: '禁止' },
    keyB: { read: 'Key A', write: '禁止' },
    description: '只讀模式，無法修改任何金鑰或 Access Bits'
  },
  '011': {
    keyA: { read: '禁止', write: 'Key B' },
    accessBits: { read: 'Key A|Key B', write: 'Key B' },
    keyB: { read: '禁止', write: 'Key B' },
    description: 'Key B 可寫入，雙金鑰可讀取 Access Bits'
  },
  '100': {
    keyA: { read: '禁止', write: 'Key B' },
    accessBits: { read: 'Key A|Key B', write: '禁止' },
    keyB: { read: '禁止', write: 'Key B' },
    description: 'Key B 可寫入金鑰，但 Access Bits 不可修改'
  },
  '101': {
    keyA: { read: '禁止', write: '禁止' },
    accessBits: { read: 'Key A|Key B', write: 'Key B' },
    keyB: { read: '禁止', write: '禁止' },
    description: '金鑰完全鎖定，只有 Key B 可修改 Access Bits'
  },
  '110': {
    keyA: { read: '禁止', write: '禁止' },
    accessBits: { read: 'Key A|Key B', write: '禁止' },
    keyB: { read: '禁止', write: '禁止' },
    description: '完全鎖定，只能讀取 Access Bits'
  },
  '111': {
    keyA: { read: '禁止', write: '禁止' },
    accessBits: { read: 'Key A|Key B', write: '禁止' },
    keyB: { read: '禁止', write: '禁止' },
    description: '完全鎖定，只能讀取 Access Bits'
  }
};

// Mifare Classic Table 6: Data Block 存取條件
const DATA_BLOCK_ACCESS_CONDITIONS = {
  '000': {
    read: 'Key A|Key B',
    write: 'Key A|Key B', 
    increment: 'Key A|Key B',
    decrement: 'Key A|Key B',
    description: '完全開放，雙金鑰均可存取'
  },
  '001': {
    read: 'Key A|Key B',
    write: '禁止',
    increment: '禁止', 
    decrement: 'Key A|Key B',
    description: '讀寫分離，僅允許減值'
  },
  '010': {
    read: 'Key A|Key B',
    write: '禁止',
    increment: '禁止',
    decrement: '禁止',
    description: '唯讀模式'
  },
  '011': {
    read: 'Key B',
    write: 'Key B',
    increment: '禁止',
    decrement: '禁止', 
    description: '僅 Key B 可讀寫'
  },
  '100': {
    read: 'Key A|Key B',
    write: 'Key B',
    increment: '禁止',
    decrement: '禁止',
    description: '雙金鑰可讀，僅 Key B 可寫'
  },
  '101': {
    read: 'Key B',
    write: '禁止',
    increment: '禁止', 
    decrement: '禁止',
    description: '僅 Key B 可讀'
  },
  '110': {
    read: 'Key A|Key B',
    write: 'Key B',
    increment: 'Key B',
    decrement: 'Key A|Key B',
    description: 'Key B 可寫入和增值，雙金鑰可減值'
  },
  '111': {
    read: '禁止',
    write: '禁止', 
    increment: '禁止',
    decrement: '禁止',
    description: '完全禁止'
  }
};

// 生成有效的存取位元 - 對應官方 Mifare Classic 規格
const generateValidAccessBits = (mode: string = 'default') => {
  const modes: { [key: string]: string } = {
    'default': generateOfficialAccessBits('000'),      // 000 模式 - 預設配置
    'editable': generateOfficialAccessBits('001'),     // 001 模式 - Key A 可修改存取位元  
    'readonly': generateOfficialAccessBits('010'),     // 010 模式 - 只讀模式
    'keyb_write': generateOfficialAccessBits('011'),   // 011 模式 - Key B 可寫入
    'keyb_control': generateOfficialAccessBits('100'), // 100 模式 - Key B 可寫金鑰
    'locked_keyb': generateOfficialAccessBits('101'),  // 101 模式 - 鎖定金鑰，Key B 改存取位元
    'fully_locked': generateOfficialAccessBits('110'), // 110 模式 - 完全鎖定
    'permanent_lock': generateOfficialAccessBits('111') // 111 模式 - 完全鎖定
  };
  
  return modes[mode] || modes['default'];
};

// 範例：使用 generateAccessBitsByBlocks 創建混合權限配置
// 這個函數展示如何為不同區塊設定不同的存取權限
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const generateMixedAccessBitsExample = () => {
  // 範例：資料區塊公開讀取，尾塊使用金鑰 B 控制
  return generateAccessBitsByBlocks(2, 2, 2, 1); // "3F0BC4"
};

// 從C1C2C3位元創建有效的存取位元（保留供未來使用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createAccessBitsFromPermissions = (
  block0: { c1: number, c2: number, c3: number },
  block1: { c1: number, c2: number, c3: number },
  block2: { c1: number, c2: number, c3: number },
  trailer: { c1: number, c2: number, c3: number }
) => {
  // 構建 byte6: !C2_3,!C2_2,!C2_1,!C2_0,!C1_3,!C1_2,!C1_1,!C1_0
  const byte6 = 
    ((1 - trailer.c2) << 7) |
    ((1 - block2.c2) << 6) |
    ((1 - block1.c2) << 5) |
    ((1 - block0.c2) << 4) |
    ((1 - trailer.c1) << 3) |
    ((1 - block2.c1) << 2) |
    ((1 - block1.c1) << 1) |
    (1 - block0.c1);
  
  // 構建 byte7: C1_3,C1_2,C1_1,C1_0,!C3_3,!C3_2,!C3_1,!C3_0
  const byte7 = 
    (trailer.c1 << 7) |
    (block2.c1 << 6) |
    (block1.c1 << 5) |
    (block0.c1 << 4) |
    ((1 - trailer.c3) << 3) |
    ((1 - block2.c3) << 2) |
    ((1 - block1.c3) << 1) |
    (1 - block0.c3);
  
  // 構建 byte8: C3_3,C3_2,C3_1,C3_0,C2_3,C2_2,C2_1,C2_0
  const byte8 = 
    (trailer.c3 << 7) |
    (block2.c3 << 6) |
    (block1.c3 << 5) |
    (block0.c3 << 4) |
    (trailer.c2 << 3) |
    (block2.c2 << 2) |
    (block1.c2 << 1) |
    block0.c2;
  
  return byte6.toString(16).padStart(2, '0').toUpperCase() +
         byte7.toString(16).padStart(2, '0').toUpperCase() +
         byte8.toString(16).padStart(2, '0').toUpperCase();
};

// 真正的存取位元位元級解析（按照 Mifare Classic 規範）
const parseAccessBitsByBlock = (accessBits: string) => {
  // 首先驗證格式
  const validation = validateAccessBits(accessBits);
  if (!validation.valid) {
    // 如果格式無效，生成一個預設的有效格式
    console.warn(`存取位元格式無效 (${accessBits}): ${validation.error}`);
    const fixedAccessBits = generateValidAccessBits('default');
    console.warn(`已自動修復為預設模式: ${fixedAccessBits}`);
    accessBits = fixedAccessBits;
  }
  
  // 確保是6位十六進制字符串（3個位元組）
  const hex = accessBits.padStart(6, '0');
  
  // 將十六進制轉換為3個位元組
  const byte6 = parseInt(hex.substr(0, 2), 16);
  const byte7 = parseInt(hex.substr(2, 2), 16);
  const byte8 = parseInt(hex.substr(4, 2), 16);
  
  // 根據 Mifare Classic 規格解析位元
  // Byte 6: !C2_3,!C2_2,!C2_1,!C2_0,!C1_3,!C1_2,!C1_1,!C1_0
  // Byte 7: C1_3,C1_2,C1_1,C1_0,!C3_3,!C3_2,!C3_1,!C3_0  
  // Byte 8: C3_3,C3_2,C3_1,C3_0,C2_3,C2_2,C2_1,C2_0
  
  const extractBlockBits = (blockNum: number) => {
    // 提取每個區塊的 C1, C2, C3 位元
    const c1 = (byte7 >> (4 + blockNum)) & 1;  // C1 位元在 byte7 的高4位
    const c2 = (byte8 >> blockNum) & 1;        // C2 位元在 byte8 的低4位
    const c3 = (byte8 >> (4 + blockNum)) & 1;  // C3 位元在 byte8 的高4位
    
    // 驗證：檢查反轉位元是否正確
    const notC1 = (byte6 >> blockNum) & 1;     // !C1 位元在 byte6 的低4位
    const notC2 = (byte6 >> (4 + blockNum)) & 1; // !C2 位元在 byte6 的高4位
    const notC3 = (byte7 >> blockNum) & 1;     // !C3 位元在 byte7 的低4位
    
    // 檢查位元一致性
    const c1Valid = c1 === (1 - notC1);
    const c2Valid = c2 === (1 - notC2);
    const c3Valid = c3 === (1 - notC3);
    
    return { 
      c1, c2, c3, 
      value: c1 * 4 + c2 * 2 + c3,
      valid: c1Valid && c2Valid && c3Valid,
      debug: {
        c1, notC1, c1Valid,
        c2, notC2, c2Valid,
        c3, notC3, c3Valid
      }
    };
  };
  
  // 根據C1C2C3值確定權限 - 使用官方 Mifare Classic 表格
  const getPermissionsByBits = (c1: number, c2: number, c3: number, isTrailer: boolean = false) => {
    const binaryString = `${c1}${c2}${c3}`;
    
    if (isTrailer) {
      // 使用官方 Table 7: Sector Trailer 存取條件
      const condition = SECTOR_TRAILER_ACCESS_CONDITIONS[binaryString as keyof typeof SECTOR_TRAILER_ACCESS_CONDITIONS];
      if (condition) {
        return {
          keyA: condition.keyA,
          accessBits: condition.accessBits,
          keyB: condition.keyB,
          description: condition.description,
          binaryValue: binaryString
        };
      }
    } else {
      // 使用官方 Table 6: Data Block 存取條件
      const condition = DATA_BLOCK_ACCESS_CONDITIONS[binaryString as keyof typeof DATA_BLOCK_ACCESS_CONDITIONS];
      if (condition) {
        return {
          read: condition.read,
          write: condition.write,
          increment: condition.increment,
          decrement: condition.decrement,
          description: condition.description,
          binaryValue: binaryString
        };
      }
    }
    
    // 如果找不到對應的條件，返回錯誤
    return isTrailer 
      ? { 
          keyA: { read: '錯誤', write: '錯誤' },
          accessBits: { read: '錯誤', write: '錯誤' },
          keyB: { read: '錯誤', write: '錯誤' },
          description: `未知的存取條件: ${binaryString}`,
          binaryValue: binaryString
        }
      : { 
          read: '錯誤', write: '錯誤', increment: '錯誤', decrement: '錯誤',
          description: `未知的存取條件: ${binaryString}`,
          binaryValue: binaryString
        };
  };
  
  // 解析每個區塊
  const block0Bits = extractBlockBits(0);
  const block1Bits = extractBlockBits(1);
  const block2Bits = extractBlockBits(2);
  const trailerBits = extractBlockBits(3);
  
  return {
    rawBytes: { byte6, byte7, byte8 },
    block0: {
      bits: block0Bits,
      permissions: getPermissionsByBits(block0Bits.c1, block0Bits.c2, block0Bits.c3)
    },
    block1: {
      bits: block1Bits,
      permissions: getPermissionsByBits(block1Bits.c1, block1Bits.c2, block1Bits.c3)
    },
    block2: {
      bits: block2Bits,
      permissions: getPermissionsByBits(block2Bits.c1, block2Bits.c2, block2Bits.c3)
    },
    trailer: {
      bits: trailerBits,
      permissions: getPermissionsByBits(trailerBits.c1, trailerBits.c2, trailerBits.c3, true)
    },
    isValidFormat: true // 可以添加格式驗證邏輯
  };
};

// 解析存取位元
const parseAccessBits = (accessBits: string) => {
  // 首先驗證格式
  const validation = validateAccessBits(accessBits);
  if (!validation.valid) {
    // 如果格式無效，使用預設模式
    accessBits = generateValidAccessBits('default');
  }
  
  // 基於官方存取條件表格生成模式描述
  const getAccessModeDescription = (accessBits: string) => {
    // 使用 parseAccessBitsByBlock 來取得官方的權限分析
    const bitAnalysis = parseAccessBitsByBlock(accessBits);
    
    // 取得尾塊的 C1C2C3 值
    const trailerBits = bitAnalysis.trailer.bits;
    const c1c2c3 = `${trailerBits.c1}${trailerBits.c2}${trailerBits.c3}`;
    
    // 取得資料區塊的權限描述（使用第一個資料區塊作為代表）
    const dataBlockPermissions = bitAnalysis.block0.permissions;
    const trailerPermissions = bitAnalysis.trailer.permissions;
    
    // 基於 C1C2C3 組合決定模式名稱和顏色
    const modeInfo = (() => {
      switch (c1c2c3) {
        case '000':
          return {
            mode: '預設模式 (000)',
            color: 'text-green-400',
            bgColor: 'bg-green-900/30'
          };
        case '001':
          return {
            mode: '金鑰 B 讀寫模式 (001)',
            color: 'text-purple-400',
            bgColor: 'bg-purple-900/30'
          };
        case '010':
          return {
            mode: '公開讀取模式 (010)',
            color: 'text-blue-400',
            bgColor: 'bg-blue-900/30'
          };
        case '011':
          return {
            mode: '金鑰 B 讀取模式 (011)',
            color: 'text-purple-300',
            bgColor: 'bg-purple-800/30'
          };
        case '100':
          return {
            mode: '只讀模式 (100)',
            color: 'text-red-400',
            bgColor: 'bg-red-900/30'
          };
        case '101':
          return {
            mode: '金鑰 B 只讀模式 (101)',
            color: 'text-purple-500',
            bgColor: 'bg-purple-700/30'
          };
        case '110':
          return {
            mode: '金鑰 B 嚴格模式 (110)',
            color: 'text-purple-600',
            bgColor: 'bg-purple-600/30'
          };
        case '111':
          return {
            mode: '禁止存取模式 (111)',
            color: 'text-gray-400',
            bgColor: 'bg-gray-900/30'
          };
        default:
          return {
            mode: '自定義模式',
            color: 'text-slate-400',
            bgColor: 'bg-slate-900/30'
          };
      }
    })();
    
    // 生成描述文字
    const description = trailerPermissions.description || '存取條件配置';
    const dataBlocks = dataBlockPermissions.description || '資料區塊權限';
    const trailer = trailerPermissions.description || '尾塊權限';
    
    return {
      mode: modeInfo.mode,
      description: description,
      color: modeInfo.color,
      bgColor: modeInfo.bgColor,
      dataBlocks: dataBlocks,
      trailer: trailer
    };
  };

  return getAccessModeDescription(accessBits);
};

// 獲取扇區的 Trailer Block 資訊
const getSectorTrailerInfo = (sectorNumber: number, memoryData: MemoryBlock[]) => {
  const trailerBlock = memoryData.find(block => 
    block.sector === sectorNumber && block.type === 'trailer'
  );
  
  if (!trailerBlock) return null;
  
  // 從實際的 data 中提取存取位元（第6-8位元組，即第12-17字符）
  const actualAccessBits = trailerBlock.data.substring(12, 18);
  
  // 創建一個新的物件，使用實際的存取位元
  return {
    ...trailerBlock,
    accessBits: actualAccessBits,
    // 也從 data 中提取實際的金鑰（雖然通常無法讀取）
    keyA: trailerBlock.data.substring(0, 12),
    keyB: trailerBlock.data.substring(20, 32)
  };
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
        <div className="p-3 bg-slate-900/50 rounded mb-3">
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
            {(() => {
              const accessInfo = parseAccessBits(selectedTrailerInfo.accessBits || '');
              return (
                <div className="mt-2 space-y-2">
                  <div className={`p-2 rounded ${accessInfo.bgColor}`}>
                    <div className={`font-bold ${accessInfo.color} text-xs`}>
                      存取模式: {accessInfo.mode}
                    </div>
                    <div className="text-slate-300 text-xs mt-1">
                      {accessInfo.description}
                    </div>
                    
                    {/* 精確的位元級分析 */}
                    <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-600">
                      <div className="text-slate-300 text-xs font-semibold mb-2">🔬 精確位元分析</div>
                      {(() => {
                        const bitAnalysis = parseAccessBitsByBlock(selectedTrailerInfo.accessBits || '');
                        return (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-4 gap-1">
                              {[0, 1, 2, 3].map(blockNum => {
                                const blockKey = blockNum === 3 ? 'trailer' : `block${blockNum}` as 'block0' | 'block1' | 'block2';
                                const blockData = bitAnalysis[blockKey];
                                return (
                                  <div key={blockNum} className="bg-slate-800/50 p-1 rounded text-center">
                                    <div className="text-slate-300 font-semibold">
                                      {blockNum === 3 ? '尾塊' : `區塊${blockNum}`}
                                    </div>
                                    <div className={`${accessInfo.color} font-mono`}>
                                      {blockData.bits.c1}{blockData.bits.c2}{blockData.bits.c3}
                                    </div>
                                    <div className="text-slate-400">
                                      ({blockData.bits.value})
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-slate-400 text-xs">
                              每個區塊的 C1C2C3 位元組合決定其獨立的存取權限
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* 詳細區塊權限 */}
                  <div className="bg-slate-800/50 p-2 rounded">
                    <div className="font-bold text-slate-200 mb-2 text-xs">當前區塊存取權限（精確分析）</div>
                    {(() => {
                      const bitAnalysis = parseAccessBitsByBlock(selectedTrailerInfo.accessBits || '');
                      const blockInSector = block.block % 4;
                      let currentBlockData;
                      let blockLabel = "";
                      
                      if (blockInSector === 0) {
                        currentBlockData = bitAnalysis.block0;
                        blockLabel = `區塊 ${block.block}`;
                      } else if (blockInSector === 1) {
                        currentBlockData = bitAnalysis.block1;
                        blockLabel = `區塊 ${block.block}`;
                      } else if (blockInSector === 2) {
                        currentBlockData = bitAnalysis.block2;
                        blockLabel = `區塊 ${block.block}`;
                      } else {
                        // 扇區尾塊
                        currentBlockData = bitAnalysis.trailer;
                        blockLabel = `區塊 ${block.block}`;
                        return (
                          <div className="border border-purple-600 rounded p-2">
                            <div className="font-semibold text-slate-300 mb-1">{blockLabel} (扇區尾塊)</div>
                            <div className="mb-2 text-xs">
                              <span className={`text-slate-200 font-mono`}>存取位元：C1C2C3 = </span>
                              <span className={`${accessInfo.color} font-mono`}>
                                {currentBlockData.bits.c1}{currentBlockData.bits.c2}{currentBlockData.bits.c3} ({currentBlockData.bits.value})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-300">金鑰A 讀取:</span>
                                <span className={`font-mono ${currentBlockData.permissions.keyA?.read === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.keyA?.read || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">金鑰A 寫入:</span>
                                <span className={`font-mono ${currentBlockData.permissions.keyA?.write === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.keyA?.write || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">存取位元 讀取:</span>
                                <span className={`font-mono ${currentBlockData.permissions.accessBits?.read === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.accessBits?.read || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">存取位元 寫入:</span>
                                <span className={`font-mono ${currentBlockData.permissions.accessBits?.write === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.accessBits?.write || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">金鑰B 讀取:</span>
                                <span className={`font-mono ${currentBlockData.permissions.keyB?.read === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.keyB?.read || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">金鑰B 寫入:</span>
                                <span className={`font-mono ${currentBlockData.permissions.keyB?.write === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.keyB?.write || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 bg-slate-800 p-2 rounded">
                              <strong>說明:</strong> {currentBlockData.permissions.description || '無可用說明'}
                            </div>
                          </div>
                        );
                      }
                      
                      if (currentBlockData) {
                        return (
                          <div className="border border-slate-600 rounded p-2">
                            <div className="font-semibold text-slate-300 mb-1">{blockLabel}</div>
                            <div className="mb-2 text-xs">
                              <span className={`text-slate-200 font-mono`}>存取位元：C1C2C3 = </span>
                              <span className={`${accessInfo.color} font-mono`}>
                                {currentBlockData.bits.c1}{currentBlockData.bits.c2}{currentBlockData.bits.c3} ({currentBlockData.bits.value})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-300">讀取:</span>
                                <span className={`font-mono ${currentBlockData.permissions.read === '禁止' ? 'text-red-400' : currentBlockData.permissions.read === '公開' ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.read}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">寫入:</span>
                                <span className={`font-mono ${currentBlockData.permissions.write === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.write}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">遞增:</span>
                                <span className={`font-mono ${currentBlockData.permissions.increment === '禁止' ? 'text-red-400' : 'text-green-400'}`}>
                                  {currentBlockData.permissions.increment}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">遞減:</span>
                                <span className={`font-mono ${currentBlockData.permissions.decrement === '禁止' ? 'text-red-400' : 'text-orange-400'}`}>
                                  {currentBlockData.permissions.decrement}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 bg-slate-800 p-2 rounded">
                              <strong>說明:</strong> {currentBlockData.permissions.description || '無可用說明'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* 特殊區塊詳細資訊 */}
      {block.type === 'trailer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-2 text-xs">扇區尾塊結構</h4>
          <div className="space-y-3 text-xs">
            {/* 結構說明 */}
            <div className="bg-slate-800/50 p-3 rounded border border-slate-600">
              <h5 className="font-semibold text-slate-200 mb-2">扇區尾塊組成</h5>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>金鑰 A (Bytes 0-5):</span>
                  <span className="font-mono text-red-300">6 位元組</span>
                </div>
                <div className="flex justify-between">
                  <span>存取位元 (Bytes 6-9):</span>
                  <span className="font-mono text-yellow-300">4 位元組</span>
                </div>
                <div className="flex justify-between">
                  <span>金鑰 B (Bytes 10-15):</span>
                  <span className="font-mono text-orange-300">6 位元組</span>
                </div>
              </div>
            </div>

            {/* 存取位元說明 */}
            <div className="bg-slate-800/50 p-3 rounded border border-yellow-600">
              <h5 className="font-semibold text-yellow-200 mb-2">存取位元控制</h5>
              <div className="space-y-1 text-slate-300 text-xs">
                <p>• 每個扇區的 4 個區塊各有獨立的 3 位元控制 (C1C2C3)</p>
                <p>• 位元組 6: !C2₃!C2₂!C2₁!C2₀!C1₃!C1₂!C1₁!C1₀ (反向)</p>
                <p>• 位元組 7: C1₃C1₂C1₁C1₀!C3₃!C3₂!C3₁!C3₀</p>
                <p>• 位元組 8: C3₃C3₂C3₁C3₀C2₃C2₂C2₁C2₀</p>
                
                {/* 調試資訊 */}
                {(() => {
                  const accessBits = block.accessBits || '';
                  const validation = validateAccessBits(accessBits);
                  
                  return (
                    <div className="mt-2 p-2 bg-gray-900/50 rounded border border-gray-600">
                      <div className="text-yellow-200 font-semibold mb-1">存取位元驗證與解析:</div>
                      
                      {/* 格式驗證結果 */}
                      <div className="mb-2 p-1 rounded border">
                        <div className={`text-xs ${validation.valid ? 'text-green-300 border-green-600' : 'text-red-300 border-red-600'}`}>
                          <span className="font-semibold">格式驗證: </span>
                          {validation.valid ? '✓ 格式正確' : `❌ ${validation.error}`}
                        </div>
                        {!validation.valid && (
                          <div className="text-xs text-orange-300 mt-1">
                            將自動使用預設模式 ({generateValidAccessBits('default')})
                          </div>
                        )}
                      </div>
                      
                      {/* 位元解析結果 */}
                      {(() => {
                        const effectiveAccessBits = validation.valid ? accessBits : generateValidAccessBits('default');
                        const bitAnalysis = parseAccessBitsByBlock(effectiveAccessBits);
                        
                        return (
                          <div>
                            <div className="text-yellow-200 text-xs mb-1">位元解析 ({effectiveAccessBits}):</div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div>區塊0: C1C2C3 = {bitAnalysis.block0.bits.c1}{bitAnalysis.block0.bits.c2}{bitAnalysis.block0.bits.c3} 
                                {bitAnalysis.block0.bits.valid ? '✓' : '❌'}</div>
                              <div>區塊1: C1C2C3 = {bitAnalysis.block1.bits.c1}{bitAnalysis.block1.bits.c2}{bitAnalysis.block1.bits.c3} 
                                {bitAnalysis.block1.bits.valid ? '✓' : '❌'}</div>
                              <div>區塊2: C1C2C3 = {bitAnalysis.block2.bits.c1}{bitAnalysis.block2.bits.c2}{bitAnalysis.block2.bits.c3} 
                                {bitAnalysis.block2.bits.valid ? '✓' : '❌'}</div>
                              <div>尾塊: C1C2C3 = {bitAnalysis.trailer.bits.c1}{bitAnalysis.trailer.bits.c2}{bitAnalysis.trailer.bits.c3} 
                                {bitAnalysis.trailer.bits.valid ? '✓' : '❌'}</div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              原始位元組: 0x{effectiveAccessBits.substr(0,2)}, 0x{effectiveAccessBits.substr(2,2)}, 0x{effectiveAccessBits.substr(4,2)}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
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
          <div className="bg-slate-900/30 p-2 rounded text-xs mb-2">
            <div className="text-slate-400">此區塊用於儲存應用程式資料。</div>
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
  const getSectorColor = (sector: number) => {
    // 簡化顏色，只區分特殊扇區
    if (sector === 0) return 'bg-blue-600'; // 製造商區塊
    if (sector === selectedSector) return 'bg-purple-600'; // 選中的扇區
    return 'bg-slate-600'; // 一般扇區
  };

  const getSectorDescription = (sector: number) => {
    if (sector === 0) return 'UID';
    return `區塊 ${sector * 4}-${sector * 4 + 3}`;
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <h4 className="font-bold mb-2 text-sm">記憶體配置圖</h4>
      <div className="grid grid-cols-4 gap-1">
        {[...Array(16)].map((_, sector) => (
          <motion.button
            key={sector}
            onClick={() => onSectorSelect(sector)}
            className={`
              p-2 rounded text-xs font-medium transition-all text-white
              ${selectedSector === sector 
                ? 'ring-2 ring-purple-400 shadow-lg' 
                : 'hover:shadow-md'
              }
              ${getSectorColor(sector)}
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div>扇區{sector}</div>
            <div className="text-xs opacity-90">
              {getSectorDescription(sector)}
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="mt-3 space-y-1">
        <div className="text-xs text-slate-400">
          總容量: 1024 bytes (64 區塊 × 16 位元組)
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
            <span className="text-slate-400">製造商區塊</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-600 rounded-sm"></div>
            <span className="text-slate-400">已選擇</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-600 rounded-sm"></div>
            <span className="text-slate-400">一般扇區</span>
          </div>
        </div>
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
      <div className="container mx-auto px-4 py-8 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-8"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mifare Classic 記憶體分布
            </h1>
          </div>
        </motion.div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Hex Editor */}
          <div className="flex-shrink-0 flex flex-col min-h-0" style={{ width: '700px' }}>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
