package com.elitearrows.app

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private var mWebView: WebView? = null
    private var mProgressBar: ProgressBar? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingFileChooserParams: WebChromeClient.FileChooserParams? = null
    private var cameraPhotoUri: Uri? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    
    companion object {
        private const val BASE_URL = "https://elite-arrows.co.uk"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 0. Initialize Activity Result Launcher
        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (filePathCallback == null) return@registerForActivityResult

            var results: Array<Uri>? = null
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                if (data == null || (data.data == null && data.clipData == null)) {
                    cameraPhotoUri?.let {
                        results = arrayOf(it)
                    }
                } else {
                    results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
                }
            }

            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
            pendingFileChooserParams = null
            cameraPhotoUri = null
        }

        // 2. Setup UI
        val layout = FrameLayout(this)
        mWebView = WebView(this)
        mProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            visibility = View.GONE
        }

        layout.addView(mWebView)
        layout.addView(mProgressBar, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 24
        ))

        setContentView(layout)
        hideSystemBars()

        // 3. Configure Back Button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (mWebView?.canGoBack() == true) {
                    mWebView?.goBack()
                } else {
                    finish()
                }
            }
        })

        // 4. Configure WebView
        setupWebView()

        if (savedInstanceState != null) {
            mWebView?.restoreState(savedInstanceState)
        } else {
            mWebView?.loadUrl(BASE_URL)
        }

        // 5. Request Notification Permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1003
                )
            }
        }
        
        // RevenueCat Integration: Handle subscription-related JS calls or UI
        setupRevenueCatListeners()
    }

    private fun setupWebView() {
        val webView = mWebView ?: return
        
        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.mediaPlaybackRequiresUserGesture = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                
                // Intercept custom subscription links if any, e.g., elitearrows://subscribe
                if (url.contains("subscribe")) {
                    SubscriptionManager.showPaywall(this@MainActivity)
                    return true
                }
                
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false
                }
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    view.context.startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return true
                }
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                mProgressBar?.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                mProgressBar?.visibility = View.GONE
                
                // Example: Inject JS to notify the web app about the user's subscription status
                SubscriptionManager.isProActive { isActive ->
                    mWebView?.evaluateJavascript("window.isEliteArrowsPro = $isActive;", null)
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    mProgressBar?.visibility = View.GONE
                    var errorDesc = ""
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        errorDesc = " Error: ${error.description} (${error.errorCode})"
                    }
                    Toast.makeText(
                        this@MainActivity,
                        "Could not load Elite Arrows.$errorDesc Please check your internet connection.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.resources)
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d("WebViewConsole", "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}")
                return true
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                this@MainActivity.pendingFileChooserParams = fileChooserParams

                if (fileChooserParams.isCaptureEnabled && !hasCameraPermission()) {
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.CAMERA),
                        CAMERA_PERMISSION_REQUEST_CODE
                    )
                    return true
                }

                launchFileChooser(fileChooserParams)
                return true
            }
        }
    }

    private fun setupRevenueCatListeners() {
        SubscriptionManager.setCustomerInfoListener { customerInfo ->
            val isActive = customerInfo.entitlements["Elite Arrows Pro"]?.isActive == true
            mWebView?.evaluateJavascript("window.isEliteArrowsPro = $isActive;", null)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        mWebView?.saveState(outState)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != CAMERA_PERMISSION_REQUEST_CODE) {
            return
        }

        if (filePathCallback == null || pendingFileChooserParams == null) {
            cancelFileChooser()
            return
        }

        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pendingFileChooserParams?.let { launchFileChooser(it) }
            return
        }

        Toast.makeText(this, "Camera permission is needed to take a result photo.", Toast.LENGTH_LONG).show()
        cancelFileChooser()
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun launchFileChooser(fileChooserParams: WebChromeClient.FileChooserParams) {
        val cameraIntent = if (hasCameraPermission()) createCameraIntent() else null
        val pickerIntent = createImagePickerIntent(fileChooserParams)
        
        val launchIntent = if (fileChooserParams.isCaptureEnabled && cameraIntent != null) {
            cameraIntent
        } else {
            Intent.createChooser(pickerIntent, "Select result proof").apply {
                if (cameraIntent != null) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                }
            }
        }

        try {
            fileChooserLauncher.launch(launchIntent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No app found to choose a result image.", Toast.LENGTH_LONG).show()
            cancelFileChooser()
        }
    }

    private fun createImagePickerIntent(fileChooserParams: WebChromeClient.FileChooserParams): Intent {
        val pickerIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
        }

        if (fileChooserParams.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            pickerIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }

        return pickerIntent
    }

    private fun cancelFileChooser() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        pendingFileChooserParams = null
        cameraPhotoUri = null
    }

    private fun createCameraIntent(): Intent? {
        val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (cameraIntent.resolveActivity(packageManager) == null) {
            return null
        }

        try {
            val photoFile = createImageFile()
            cameraPhotoUri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                photoFile
            )
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            
            val cameraActivities = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.queryIntentActivities(cameraIntent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()))
            } else {
                packageManager.queryIntentActivities(cameraIntent, PackageManager.MATCH_DEFAULT_ONLY)
            }
            
            for (resolveInfo in cameraActivities) {
                grantUriPermission(
                    resolveInfo.activityInfo.packageName,
                    cameraPhotoUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
            }
            return cameraIntent
        } catch (e: IOException) {
            cameraPhotoUri = null
            return null
        }
    }

    private fun createImageFile(): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.UK).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("elite_arrows_result_${timestamp}_", ".jpg", storageDir)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    private fun hideSystemBars() {
        val decorView = window.decorView
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            decorView.windowInsetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
        }
    }
}
