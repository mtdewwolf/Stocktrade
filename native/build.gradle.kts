plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.kmp.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

val repoRoot = projectDir.parentFile

tasks.register<Exec>("generateNativeSpec") {
    group = "build"
    description = "Generate the shared native game spec from the web reference data."
    workingDir = repoRoot
    commandLine("node", "native/tools/extract-spec.cjs")
    inputs.file(repoRoot.resolve("src/data.js"))
    inputs.file(repoRoot.resolve("package.json"))
    inputs.file(repoRoot.resolve("native/tools/extract-spec.cjs"))
    outputs.dir(layout.projectDirectory.dir("spec/build"))
}
