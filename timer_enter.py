import sys
import time
from datetime import datetime, timedelta
import pyautogui

def parse_args():
    if len(sys.argv) < 3:
        print("【錯誤】無效的參數傳遞。")
        sys.exit(1)
        
    flag = sys.argv[1]
    val = sys.argv[2]
    
    if flag in ['--delay', '-d']:
        unit = val[-1].lower()
        num = int(val[:-1])
        if unit == 'h': return datetime.now() + timedelta(hours=num)
        if unit == 'm': return datetime.now() + timedelta(minutes=num)
        if unit == 's': return datetime.now() + timedelta(seconds=num)
    elif flag in ['--time', '-t']:
        if len(val) == 8: # HH:MM:SS
            today = datetime.now().date()
            t = datetime.strptime(val, "%H:%M:%S").time()
            target = datetime.combine(today, t)
            if target <= datetime.now():
                target += timedelta(days=1)
            return target
        return datetime.strptime(val, "%Y-%m-%d %H:%M:%S")
    sys.exit(1)

def main():
    target_time = parse_args()
    print(f"[*] auto-enter 核心啟動（PyInstaller 封裝版）")
    print(f"[*] 目標時間：{target_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[*] 請維持 AI 輸入框的焦點 (Focus)...")
    print("-" * 50)
    
    try:
        while True:
            now = datetime.now()
            if now >= target_time:
                pyautogui.press('enter')
                print("\n[!] 時間到！已發射實體 Enter 鍵訊號。")
                break
            diff = target_time - now
            hours, remainder = divmod(int(diff.total_seconds()), 3600)
            minutes, seconds = divmod(remainder, 60)
            print(f"剩餘時間: {hours}h {minutes}m {seconds}s", end="\r")
            sys.stdout.flush()
            time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    main()