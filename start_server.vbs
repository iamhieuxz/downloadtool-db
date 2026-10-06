' Script khởi động web server ở chế độ ẩn (không hiện console)
' Tùy chỉnh đường dẫn dưới đây nếu cài ở vị trí khác
Option Explicit

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' === CẤU HÌNH ===
' Thay đổi 2 biến dưới đây cho phù hợp môi trường của bạn
Const PROJECT_DIR = "F:\web-app"
Const PYTHON_EXE = "python"  ' Hoặc đường dẫn đầy đủ: "C:\Python311\python.exe"

' Chuyển working directory
WshShell.CurrentDirectory = PROJECT_DIR

' Chạy ẩn (0 = ẩn cửa sổ)
WshShell.Run PYTHON_EXE & " -m uvicorn web_server:app --host 127.0.0.1 --port 8000 --log-level warning", 0, False

Set WshShell = Nothing
