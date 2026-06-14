# TWA / Android Browser Helper Rules
-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.customtabs.** { *; }

# Keep application and main classes
-keep class com.elitearrows.app.** { *; }
-keep public class com.elitearrows.app.MainApplication extends android.app.Application { *; }

# Capacitor
-keep class com.getcapacitor.** { *; }

# Prevent R8 from removing components defined in Manifest
-keepclassmembers class * extends android.app.Application {
  public <init>();
  void onCreate();
}

# Keep splash screen and resource related classes
-keep class com.elitearrows.app.R$* { *; }
