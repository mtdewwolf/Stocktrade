import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp.library)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    jvm()

    android {
        namespace = "com.mtdewwolf.stocktrade.core"
        compileSdk = 37
        minSdk = 26
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    if (System.getProperty("os.name").startsWith("Mac")) {
        iosX64()
        iosArm64()
        iosSimulatorArm64()
    }

    sourceSets {
        commonMain.dependencies {
            implementation(libs.kotlinx.serialization.json)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
        getByName("jvmTest") {
            resources.srcDir("../spec/build")
        }
    }
}

tasks.named("jvmTest") {
    dependsOn(rootProject.tasks.named("generateNativeSpec"))
}

tasks.named("jvmTestProcessResources") {
    dependsOn(rootProject.tasks.named("generateNativeSpec"))
}
