@echo off
:: افزودن قانون فایروال برای اجازه ورود گوشی به پورت ۳۰۰۰ (اشتراک‌گذاری گروه‌نوازی آکوردیار)
:: این فایل را با راست‌کلیک روی آن و انتخاب "Run as administrator" اجرا کنید.
netsh advfirewall firewall delete rule name="Akordyar Sync 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Akordyar Sync 3000" dir=in action=allow protocol=TCP localport=3000
if %errorlevel%==0 (
  echo.
  echo [OK] قانون فایروال برای پورت ۳۰۰۰ اضافه شد.
  echo حالا گوشی می‌تواند به آدرس نمایش‌داده‌شده وصل شود.
) else (
  echo.
  echo [خطا] اجرا نشد. لطفاً این فایل را با دسترسی Administrator اجرا کنید.
)
pause
