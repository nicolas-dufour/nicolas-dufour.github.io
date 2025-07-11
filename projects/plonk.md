---
layout: project
permalink: /plonk
title: "Around the World in 80 Timesteps: <br> A Generative Approach to Global Visual Geolocation"
short_name: PLONK
css: css/projects/plonk.css
video_background: /assets/publications/plonk/animation.mp4
author: Nicolas Dufour
description: We propose the first generative approach for global visual geolocation that predicts where an image was captured on Earth. Our model achieves state-of-the-art performance on major benchmarks while handling location ambiguity through probabilistic predictions. The denoising process operates directly on the Earth's surface using Riemannian flow matching.
keywords: diffusion models, flow matching, Riemannian flow matching, visual geolocation, global visual geolocation, generative models, PLONK
analytics: https://www.googletagmanager.com/gtag/js?id=ANALYTICS_TAG_PLACEHOLDER
teaser:
    url: /assets/publications/plonk/teaser.png
    caption: "Our model predicts location distributions for images from three major visual geolocation datasets: iNat-21 (wildlife), YFCC-100M (natural images), and OSV-5M (street-view). The model can handle varying levels of location ambiguity by outputting appropriate probability distributions."

paper_title: "Around the World in 80 Timesteps: A Generative Approach to Global Visual Geolocation"
paper_authors: <a href="/">Nicolas Dufour</a>, <a href="https://davidpicard.github.io/">David Picard</a>, <a href="http://vicky.kalogeiton.info/">Vicky Kalogeiton</a>, <a href="https://loiclandrieu.com/">Loic Landrieu</a>
journal:
buttons:
  - type: github
    text: Code
    url: https://github.com/nicolas-dufour/plonk
  - type: arxiv
    text: Paper
    url: https://arxiv.org/abs/2412.06781
  - type: gradio
    text: "Demo"
    url: "#demo"
  - type: hugging_face
    text: "Models"
    url: https://huggingface.co/nicolas-dufour/PLONK_YFCC
#   - type: pdf
#     text: Poster
    # url: /assets/publications/cad_cvpr/poster.pdf
#   - type: video
#     text: Video
#     url: 

abstract: "<p>Introducing the first generative geolocation method based on diffusion and flow matching! We learn the relationship between visual content and location by denoising random locations conditionally to images.</p>

<p>➜ New SOTA for visual geolocation on OpenStreetView-5M, YFCC-100M, and iNat-21</p>

<p>➜ Generate global probability density maps and quantify localizability</p>

<p>➜ Introduce the problem of probabilistic visual geolocation</p>"
# poster: 
#     url: /assets/publications/cad_cvpr/poster.pdf
# video: 
#     url: https://www.youtube.com/embed/4Tu-x2-Zcxs?si=17Ho_9xjTlFqy7pm
bibtex: "@article{dufour2024world80timestepsgenerative, \n
      &nbsp;&nbsp;  title           ={Around the World in 80 Timesteps: A Generative Approach to Global Visual Geolocation}, \n
      &nbsp;&nbsp;  author          ={Nicolas Dufour and David Picard and Vicky Kalogeiton and Loic Landrieu}, \n
      &nbsp;&nbsp;  year            ={2024}, \n
      &nbsp;&nbsp;  eprint          ={2412.06781}, \n
      &nbsp;&nbsp;  archivePrefix   ={arXiv}, \n
}"
acknowledgements: This work was supported by ANR project TOSAI ANR-20-IADJ-0009, and was granted access to the HPC resources of IDRIS under the allocation 2024-AD011015664 made by GENCI. We would like to thank Julie Mordacq, Elliot Vincent, and Yohann Perron for their helpful feedback.
demo:
    url: https://nicolas-dufour-plonk.hf.space
has_samples: true
samples_section: >
    <h2 style="text-align:center; margin-bottom:30px;">Sample Predictions</h2>
    <div class="slideshow-container">
    <!-- Full-width images with number and caption text -->
    <div class="mySlides fade">
        <div class="numbertext">1 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/yfcc_low.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/yfcc_low_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">YFCC Dataset - Low Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">2 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/yfcc_medium.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/yfcc_medium_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">YFCC Dataset - Medium Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">3 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/yfcc_high.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/yfcc_high_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">YFCC Dataset - High Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">4 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/osv_low.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/osv_low_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">OpenStreetView Dataset - Low Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">5 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/osv_medium.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/osv_medium_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">OpenStreetView Dataset - Medium Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">6 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/osv_high.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/osv_high_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">OpenStreetView Dataset - High Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">7 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/inat_low.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/inat_low_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">iNaturalist Dataset - Low Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">8 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/inat_medium.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/inat_medium_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">iNaturalist Dataset - Medium Localizability</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">9 / 9</div>
        <div class="slide-content">
            <div class="slide-image">
                <img src="/assets/publications/plonk/samples/inat_high.png" alt="Input image">
            </div>
            <div class="slide-map">
                <img src="/assets/publications/plonk/samples/inat_high_map.png" alt="Predicted map">
            </div>
        </div>
        <div class="carousel_caption">iNaturalist Dataset - High Localizability</div>
    </div>
    <!-- Next and previous buttons -->
    <a class="prev" onclick="plusSlides(-1)">&#10094;</a>
    <a class="next" onclick="plusSlides(1)">&#10095;</a>
    </div>
    <br>
    <!-- The dots/circles -->
    <div style="text-align:center">
        <span class="dot" onclick="currentSlide(1)"></span>
        <span class="dot" onclick="currentSlide(2)"></span>
        <span class="dot" onclick="currentSlide(3)"></span>
        <span class="dot" onclick="currentSlide(4)"></span>
        <span class="dot" onclick="currentSlide(5)"></span>
        <span class="dot" onclick="currentSlide(6)"></span>
        <span class="dot" onclick="currentSlide(7)"></span>
        <span class="dot" onclick="currentSlide(8)"></span>
        <span class="dot" onclick="currentSlide(9)"></span>
    </div>
    <div style="padding-top:30px; text-align:center; font-style:italic;">
        Sample predicted distributions on different datasets with varying levels of localizability.
    </div>
---
<div class="section">
    <h2>Pipeline</h2>
    <div style="width:80%; margin:auto">
        <img src="/assets/publications/plonk/pipeline.png">
        <p>Our model operates in three main steps:</p>
        <ol>
            <li>A vision encoder Φ extracts features from the input image</li>
            <li>A conditional flow matching model Ψ progressively denoises coordinates on the Earth's surface by predicting velocity fields at each timestep</li>
            <li>An ODE solver integrates these velocity fields to obtain the final location distribution</li>
        </ol>
        <p>The denoising process operates directly on the Earth's surface using Riemannian flow matching, which ensures that all intermediate points remain valid geographical coordinates.</p>
        <p>The model can handle location ambiguity through its probabilistic predictions - when an image could have been taken in multiple locations (like a football field), the model outputs a multi-modal distribution covering all plausible locations.</p>

    </div>
</div>
<script>
    let slideIndex = 3;
    showSlides(slideIndex);
    // Next/previous controls
    function plusSlides(n) {
        showSlides(slideIndex += n);
    }
    // Thumbnail image controls
    function currentSlide(n) {
        showSlides(slideIndex = n);
    }
    function adjustMapHeight() {
        const currentSlide = document.getElementsByClassName("mySlides")[slideIndex - 1];
        const image = currentSlide.querySelector(".slide-image img");
        const mapContainer = currentSlide.querySelector(".slide-map");
        
        // Wait for image to load to get its height
        if (image.complete) {
            mapContainer.style.height = image.offsetHeight + "px";
        } else {
            image.onload = function() {
                mapContainer.style.height = image.offsetHeight + "px";
            }
        }
    }
    function showSlides(n) {
        let i;
        let slides = document.getElementsByClassName("mySlides");
        let dots = document.getElementsByClassName("dot");
        if (n > slides.length) { slideIndex = 1 }
        if (n < 1) { slideIndex = slides.length }
        for (i = 0; i < slides.length; i++) {
            slides[i].style.display = "none";
        }
        for (i = 0; i < dots.length; i++) {
            dots[i].className = dots[i].className.replace(" active", "");
        }
        slides[slideIndex - 1].style.display = "block";
        dots[slideIndex - 1].className += " active";
        
        // Add this line to adjust map height after showing slide
        adjustMapHeight();
    }
    // Add resize listener to handle window resizing
    window.addEventListener('resize', adjustMapHeight);
</script>