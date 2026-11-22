package com.duckbuster.inappupdates

import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play In-App Updates (flexible flow). Talks only to the Play Store app on the
 * phone — no server of ours. Only works on installs that came from Play; anywhere else
 * the check simply reports "no update".
 */
class InAppUpdatesModule : Module() {
  private var manager: AppUpdateManager? = null

  private val listener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) sendEvent("onDownloaded", mapOf<String, Any>())
  }

  private fun mgr(): AppUpdateManager? {
    if (manager == null) {
      val ctx = appContext.reactContext ?: return null
      manager = AppUpdateManagerFactory.create(ctx).also { it.registerListener(listener) }
    }
    return manager
  }

  override fun definition() = ModuleDefinition {
    Name("InAppUpdates")
    Events("onDownloaded")

    OnDestroy { manager?.unregisterListener(listener) }

    // 'none' | 'available' | 'downloaded'
    AsyncFunction("check") { promise: Promise ->
      val m = mgr() ?: return@AsyncFunction promise.resolve("none")
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          promise.resolve(
            when {
              info.installStatus() == InstallStatus.DOWNLOADED -> "downloaded"
              info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
                info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> "available"
              else -> "none"
            }
          )
        }
        .addOnFailureListener { promise.resolve("none") }
    }

    // Shows Play's own update sheet; the download then runs in the background.
    AsyncFunction("start") { promise: Promise ->
      val m = mgr()
      val activity = appContext.currentActivity
      if (m == null || activity == null) return@AsyncFunction promise.resolve(false)
      m.appUpdateInfo
        .addOnSuccessListener { info ->
          if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
            !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
          ) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          try {
            @Suppress("DEPRECATION")
            val started = m.startUpdateFlowForResult(info, activity, AppUpdateOptions.defaultOptions(AppUpdateType.FLEXIBLE), REQUEST_CODE)
            promise.resolve(started)
          } catch (e: Exception) {
            promise.resolve(false)
          }
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    // Installs a downloaded update; the app restarts.
    AsyncFunction("complete") {
      mgr()?.completeUpdate()
      Unit
    }
  }

  companion object {
    private const val REQUEST_CODE = 4711
  }
}
