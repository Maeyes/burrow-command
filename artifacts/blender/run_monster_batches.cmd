@echo off
C:\PROGRA~1\BLENDE~1\BLENDE~1.2\blender.exe -b -P C:\bunny-world\artifacts\blender\build_greenfield_batch2.py
if errorlevel 1 exit /b 1
C:\PROGRA~1\BLENDE~1\BLENDE~1.2\blender.exe -b -P C:\bunny-world\artifacts\blender\build_windwood_batch3.py
