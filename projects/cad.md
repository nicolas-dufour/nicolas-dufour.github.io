---
layout: project
permalink: /cad
title: Don’t drop your samples! Coherence-aware training benefits Conditional diffusion
short_name: CAD
css: css/projects/cad.css
background: /assets/publications/cad_cvpr/background_banner.jpg
author: Nicolas Dufour
description: This paper proposes Coherence-Aware Diffusion (CAD), a novel method that integrates noise handling into generative diffusion models. By conditioning the model on both the input data and its associated coherence score, CAD learns to ignore noisy or unreliable annotations. This approach allows for more robust training and generation of realistic samples that respect conditional information.
keywords: image generation, diffusion models, noise handling, coherence, conditional information, generative models, CAD
analytics: https://www.googletagmanager.com/gtag/js?id=G-V8HK2ZSXGW

paper_title: Don’t drop your samples! Coherence-aware training benefits Conditional diffusion
paper_authors: <a href="/">Nicolas Dufour</a>, <a href="https://scholar.google.com/citations?user=n_C2h-QAAAAJ&hl=fr">Victor Besnier</a>,  <a href="http://vicky.kalogeiton.info/">Vicky Kalogeiton</a>, <a href="https://davidpicard.github.io/">David Picard</a>
journal: CVPR 2024
award: Highlight
buttons:
  - type: github
    text: Code
    url: https://github.com/nicolas-dufour/CAD
  - type: arxiv
    text: Paper
    url: https://arxiv.org/abs/2405.20324
  - type: gradio
    text: "Demo"
    url: "#demo"
  - type: hugging_face
    text: "Models <br> (soon)"
    url: "#"
  - type: pdf
    text: Poster
    url: /assets/publications/cad_cvpr/poster.pdf
  - type: video
    text: Video
    url: https://youtu.be/4Tu-x2-Zcxs?si=17Ho_9xjTlFqy7pm

abstract:  Conditional diffusion models are powerful generative models that can leverage various types of conditional information, such as class labels, segmentation masks, or text captions. However, in many real-world scenarios, conditional information may be noisy or unreliable due to human annotation errors or weak alignment. In this paper, we propose the Coherence-Aware Diffusion (CAD), a novel method that integrates coherence in conditional information into diffusion models, allowing them to learn from noisy annotations without discarding data. We assume that each data point has an associated coherence score that reflects the quality of the conditional information. We then condition the diffusion model on both the conditional information and the coherence score. In this way, the model learns to ignore or discount the conditioning when the coherence is low. We show that CAD is theoretically sound and empirically effective on various conditional generation tasks. Moreover, we show that leveraging coherence generates realistic and diverse samples that respect conditional information better than models trained on cleaned datasets where samples with low coherence have been discarded.
poster: 
    url: /assets/publications/cad_cvpr/poster.pdf
video: 
    url: https://www.youtube.com/embed/4Tu-x2-Zcxs?si=17Ho_9xjTlFqy7pm
bibtex: "@article{dufour2024dont, \n
   &nbsp;&nbsp; title={Don’t drop your samples! Coherence-aware training \n
   &nbsp;&nbsp; benefits Conditional diffusion}, \n
   &nbsp;&nbsp; author={Dufour, Nicolas and Besnier, Victor and Kalogeiton, Vicky and \n
   &nbsp;&nbsp; Picard, David}, \n
   &nbsp;&nbsp; booktitle={CVPR}, \n
   &nbsp;&nbsp; year={2024}, \n
   }"
acknowledgements: This work was supported by ANR project TOSAI ANR-20-IADJ-0009, and was granted access to the HPC resources of IDRIS under the allocation 2023-AD011014246 made by GENCI. We would like to thank Vincent Lepetit, Romain Loiseau, Robin Courant, Mathis Petrovich, Teodor Poncu and the anonymous reviewers for their insightful comments and suggestion.
demo:
    url: https://2f3b5fd3a588d0dd11.gradio.live/
has_samples: true
samples_section: >
    <h2 style="text-align:center; margin-bottom:30px;">Generated Samples</h2>
    <div class="slideshow-container">
    <!-- Full-width images with number and caption text -->
    <div class="mySlides fade">
        <div class="numbertext">1 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/0.jpg" style="width:100%">
        <div class="carousel_caption">An old-world galleon navigating through turbulent ocean waves under stormy sky lit by flashes of lightning</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">2 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/1.jpg" style="width:100%">
        <div class="carousel_caption">an oil painting of rain at a traditional Chinese town</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">3 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/2.jpg" style="width:100%">
        <div class="carousel_caption">portrait photo of a asia old warrior chief tribal panther make up blue on red side profile looking away serious eyes 50mm portrait photography hard rim lighting photography</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">4 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/3.jpg" style="width:100%">
        <div class="carousel_caption">a blue jay stops on the top of a helmet of Japanese samurai background with sakura tree</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">5 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/4.jpg" style="width:100%">
        <div class="carousel_caption">A cute little matte low poly isometric cherry blossom forest island waterfalls lighting soft shadows trending on Artstation 3d render monument valley fez video game.</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">6 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/5.jpg" style="width:100%">
        <div class="carousel_caption">Underwater cathedral</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">7 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/6.jpg" style="width:100%">
        <div class="carousel_caption">A cozy gingerbread house nestled in a dusting of powdered sugar snow adorned with vibrant candy canes and shimmering gumdrops</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">8 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/7.jpg" style="width:100%">
        <div class="carousel_caption">a  teddy bear wearing blue ribbon taking selfie in a small boat in the center of a lake</div>
    </div>
    <div class="mySlides fade">
        <div class="numbertext">9 / 9</div>
        <img src="/assets/publications/cad_cvpr/images_with_text/8.jpg" style="width:100%">
        <div class="carousel_caption">Pirate ship trapped in a cosmic maelstrom nebula rendered in cosmic beach whirlpool engine volumetric lighting spectacular ambient lights light pollution cinematic atmosphere art nouveau style illustration art artwork by SenseiJaye intricate detail.</div>
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
        Samples from our 150M parameters TextRIN at resolution 512 leveraging Coherence-Aware Diffusion training.
    </div>
---
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
    }
</script>

<div class="section">
    <h2>Varying the Coherence</h2>
    <div class="varying-coherence-container">
        <div class="varying-coherence-main">
            <div class="image-container">
                <img src="/assets/publications/cad_cvpr/varying_coherence.png">
            </div>
            <p class="varying-coherence-legend">Examples of images generated with the input coherence score between the prompt and the target image. The score varies from 0 (no coherence) to 1 (maximum coherence). Higher coherence scores tend to generate images that adhere more effectively to the prompt.</p>
        </div>
        <div class="prompts-container">
            <div class="prompt-box">
                <h4>Top prompt:</h4>
                <p>"a raccoon wearing an astronaut suit. The racoon is looking out of the window at a starry night; unreal engine, detailed, digital painting, cinematic, character design by pixar and hayao miyazaki unreal 5, daz, hyperrealistic, octane render"</p>
            </div>
            <div class="prompt-box">
                <h4>Bottom prompt:</h4>
                <p>"An armchair in the shape of an avocado"</p>
            </div>
        </div>
    </div>
</div>

<div class="section">
    <h2>Convergence towards the unconditional distribution</h2>
    <div style="width:80%; margin:auto">
        <div style="display: flex; justify-content: space-around; flex-direction: row; width:100%; margin:auto">
        <img src="/assets/publications/cad_cvpr/tsne_mixer.png", style="width:45%; margin:auto">
        <img src="/assets/publications/cad_cvpr/confidence_images.png", style="width:45%; margin:auto">
        </div>
        <p>When varying the coherence towards zero, we observe that the model converges to the same unconditional model. In the CIFAR embedding space (left) we observe that the embeddings converge to the same point. On Imagenet (right), we see that no matter the label, the output image becomes the same as we decrease the coherence.</p>
    </div>
</div>

<div class="section">
    <h2>TextRIN: A new text-to-image architecture</h2>
    <div style="width:80%; margin:auto">
        <img src="/assets/publications/cad_cvpr/text_rin.png">
        <p> We propose a new text-to-image architecture based on the RIN (Jabri et al, 2023). Similar to RIN, our architecture has the advantage to do most of the computation in a restricted latent space, which allows for efficient sampling and training. However, we introduce a new module, the TextRIN, that conditions the RIN on the input text. It also incorporates the coherence score between the input text and the target image. This allows the model to generate images that respect the input text better. <br>
        </p>
    </div>
</div>