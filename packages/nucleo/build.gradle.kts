// Núcleo Kotlin puro del recorder (contrato de H1, sección 17), con versiones exactas (SUM-07).
plugins {
    kotlin("jvm") version "2.1.20"
    id("ru.vyarus.animalsniffer") version "2.0.1"
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation("org.bouncycastle:bcprov-jdk18on:1.86")
    // Corre en Android con minSdk 24: animal-sniffer falla si src/main usa una API que Android 7 no tiene.
    signature("net.sf.androidscents.signature:android-api-level-24:7.0_r2@signature")
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.3")
    testImplementation("org.json:json:20260814")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.1.3")
}

animalsniffer { sourceSets = listOf(project.sourceSets["main"]) }

tasks.test {
    dependsOn("animalsnifferMain")
    useJUnitPlatform()
    jvmArgs("-Dfile.encoding=UTF-8")
}

// Escribe ../shared/vectores/firmas-kotlin.json con una clave efímera (contrato, sección 18).
tasks.register<JavaExec>("firmasKotlin") {
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("vigia.nucleo.FirmasKotlinKt")
    args(file("../shared/vectores/firmas-kotlin.json").path)
}
